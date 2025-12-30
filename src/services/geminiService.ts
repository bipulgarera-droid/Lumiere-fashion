import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize the client. 
// Note: In a real production app, ensure this is handled securely.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const generateSingleImage = async (
  cleanBase64: string,
  promptText: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: promptText,
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    });

    // Parse response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data found in response.");
  } catch (error) {
    console.error("Gemini Single Generation Error:", error);
    throw error;
  }
}

export const generateFashionAssets = async (
  imageBase64: string,
  promptText: string,
  aspectRatio: AspectRatio,
  count: number = 3
): Promise<string[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  // Handle both raw Base64 strings and Data URLs safely
  let cleanBase64 = imageBase64;
  if (imageBase64.includes('base64,')) {
    cleanBase64 = imageBase64.split('base64,')[1];
  }

  // Create parallel requests for 'count' number of images
  const promises = Array(count).fill(null).map(() => generateSingleImage(cleanBase64, promptText, aspectRatio));

  try {
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error("Batch Generation Error:", error);
    throw error;
  }
};