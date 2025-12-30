import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize the client. 
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateSingleImage = async (
  productBase64: string,
  promptText: string,
  aspectRatio: AspectRatio,
  modelBase64?: string
): Promise<string> => {
  let lastError: any;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const parts: any[] = [
        { text: promptText },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: productBase64
          }
        }
      ];

      // Add model reference image if provided
      if (modelBase64) {
        if (attempt === 1) console.log('Adding model character reference to parts');
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: modelBase64
          }
        });
      }

      console.log(`Sending request to Gemini 2.5 Flash Image (Attempt ${attempt}/${MAX_RETRIES})...`);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          }
        }
      });

      if (response.candidates && response.candidates.length > 0) {
        const parts = response.candidates[0].content.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            console.log('Gemini successfully generated image data');
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      throw new Error("No image data found in response.");

    } catch (error) {
      console.warn(`Gemini Generation Attempt ${attempt} failed:`, error);
      lastError = error;

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1000ms, 2000ms, 4000ms
        const waitTime = 1000 * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }
    }
  }

  // If we get here, all retries failed
  console.error("Gemini Generation failed after max retries:", lastError);
  if (typeof lastError === 'object' && lastError !== null && 'message' in lastError) {
    throw new Error(`Gemini Error (after ${MAX_RETRIES} attempts): ${lastError.message}`);
  }
  throw lastError;
}

// Helper to fetch an image and return its base64 data
const imageToBase64 = async (urlOrBase64: string): Promise<string> => {
  if (urlOrBase64.includes('base64,')) {
    return urlOrBase64.split('base64,')[1];
  }

  console.log('Converting image URL to base64:', urlOrBase64);
  const response = await fetch(urlOrBase64);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split('base64,')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper to resize and compress image to reduce payload size
const optimizeImage = async (inputStr: string, maxWidth = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Enable CORS for external URLs (Supabase)
    img.crossOrigin = 'Anonymous';

    // Handle both Base64 (raw or with prefix) and URLs
    if (inputStr.startsWith('http')) {
      img.src = inputStr;
    } else if (inputStr.startsWith('data:')) {
      img.src = inputStr;
    } else {
      // Assume raw base64
      img.src = `data:image/jpeg;base64,${inputStr}`;
    }

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw and compress
      try {
        ctx.drawImage(img, 0, 0, width, height);
        // specific JPEG compression to reduce size
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(optimizedDataUrl.split('base64,')[1]);
      } catch (err) {
        reject(new Error('Canvas export failed (likely CORS issue): ' + err));
      }
    };

    img.onerror = (e) => {
      console.error('Image Load Error:', e);
      reject(new Error('Image optimization failed to load source. Check if URL is valid.'));
    };
  });
};

export const generateFashionAssets = async (
  imageBase64: string,
  promptText: string,
  aspectRatio: AspectRatio,
  count: number = 3,
  modelBase64?: string
): Promise<string[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  try {
    // 1. Clean & Optimize product image
    const rawProductBase64 = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    console.log('Optimizing product image...');
    const cleanProductBase64 = await optimizeImage(rawProductBase64);

    // 2. Use provided model base64 directly (and optimize it)
    let cleanModelBase64: string | undefined;
    if (modelBase64) {
      console.log('Optimizing model image...');
      cleanModelBase64 = await optimizeImage(modelBase64);
    }

    console.log(`Starting generation of ${count} assets...`);
    // Use sequential or controlled parallel requests to avoid rate limits with larger inputs
    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      console.log(`Generating image ${i + 1} of ${count}`);
      const result = await generateSingleImage(cleanProductBase64, promptText, aspectRatio, cleanModelBase64);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error('Asset Generation Pipeline failed:', error);
    throw error;
  }
};