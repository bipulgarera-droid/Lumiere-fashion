
import Upscaler from 'upscaler';

// Initialize Upscaler with default options (Uses widely compatible GANS model by default)
// You can specify models: { model: 'esrgan-thick', scale: 2 } if you install specific model packages
// For now, valid default (2x) is fine.
const upscaler = new Upscaler();

export const upscaleImage = async (imageUrl: string, factor: string = "2x"): Promise<string> => {
    console.log("🚀 Starting Client-Side Upscale (UpscalerJS)...");

    try {
        // 1. Load Image explicitly with CrossOrigin to prevent Tainted Canvas errors
        // This is critical for production when images are hosted on Supabase (different domain)
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load image for upscaling"));
        });

        // 2. Upscale
        const upscaledDataUrl = await upscaler.upscale(img, {
            patchSize: 64, // Process in chunks to avoid UI freeze
            padding: 2,
            progress: (percent) => {
                console.log(`Upscale Progress: ${Math.round(percent * 100)}%`);
            }
        });

        console.log("✅ Client-Side Upscale Complete!");
        return upscaledDataUrl;

    } catch (err) {
        console.error("Local Upscale Failed:", err);
        // Fallback or re-throw
        throw new Error("Local upscaling failed. Check console/memory.");
    }
};
