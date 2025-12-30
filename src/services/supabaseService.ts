import { createClient } from '@supabase/supabase-js';

// Basic type definition for Vite env
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Support both process.env (from define) and import.meta.env (Vite standard)
const supabaseUrl = process.env.SUPABASE_URL || (import.meta as unknown as ImportMeta).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || (import.meta as unknown as ImportMeta).env?.VITE_SUPABASE_ANON_KEY || '';

console.log('Supabase Initialization:', {
    url: supabaseUrl ? 'Set' : 'Missing',
    key: supabaseAnonKey ? 'Set' : 'Missing'
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Model Library will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export interface SavedModel {
    id: string;
    name: string;
    description: string;
    image_url: string; // Supabase Storage URL
    created_at: string;
}

export interface SavedAsset {
    id: string;
    image_url: string;
    prompt: string;
    model_id?: string;
    environment?: string;
    camera_angle?: string;
    camera_framing?: string;
    model_pose?: string;
    aspect_ratio?: string;
    is_shortlisted: boolean;
    created_at: string;
}

// Helper to convert base64/DataURL to Fetch-ready Blob
const getBlobFromBase64 = async (base64String: string): Promise<Blob> => {
    const response = await fetch(base64String);
    const blob = await response.blob();
    return blob;
};

// Model Library functions
export const modelLibrary = {
    // Get all saved models
    async getModels(): Promise<SavedModel[]> {
        console.log('Fetching models from Supabase...');
        const { data, error } = await supabase
            .from('models')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch models:', error);
            return [];
        }
        console.log(`Fetched ${data?.length || 0} models`);
        return data || [];
    },

    // Save a new model (upload image + create record)
    async saveModel(name: string, description: string, imageBase64: string): Promise<SavedModel | null> {
        console.log('Starting saveModel for:', name);
        try {
            // Robust blob conversion
            const blob = await getBlobFromBase64(imageBase64);
            console.log('Blob created, size:', blob.size);

            // Generate unique filename
            const fileName = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;

            // Upload to Supabase Storage
            console.log('Uploading to model-images bucket...');
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('model-images')
                .upload(fileName, blob, {
                    contentType: 'image/png',
                    upsert: false
                });

            if (uploadError) {
                console.error('Supabase Storage Upload Error:', uploadError);
                alert(`Storage Upload Failed: ${uploadError.message}`);
                return null;
            }

            console.log('Upload successful:', uploadData.path);

            // Get public URL
            const { data: urlData } = supabase
                .storage
                .from('model-images')
                .getPublicUrl(fileName);

            const imageUrl = urlData.publicUrl;
            console.log('Public URL generated:', imageUrl);

            // Create database record
            console.log('Inserting record into models table...');
            const { data, error } = await supabase
                .from('models')
                .insert([{ name, description, image_url: imageUrl }])
                .select()
                .single();

            if (error) {
                console.error('Supabase Database Insert Error:', error);
                alert(`Database Save Failed: ${error.message}`);
                return null;
            }

            console.log('Database record created successfully:', data.id);
            return data;
        } catch (err) {
            console.error('Unexpected Error in saveModel:', err);
            alert(`Unexpected Error: ${err instanceof Error ? err.message : String(err)}`);
            return null;
        }
    },

    // Get model image as Base64 (helper for generation)
    async getModelImageBase64(imageUrl: string): Promise<string | null> {
        try {
            console.log('Downloading model image from:', imageUrl);

            // Attempt 1: Direct fetch (fastest for public URLs)
            try {
                const response = await fetch(imageUrl, { mode: 'cors' });
                if (!response.ok) throw new Error('Fetch failed');
                const blob = await response.blob();
                return await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split('base64,')[1]);
                    reader.readAsDataURL(blob);
                });
            } catch (fetchError) {
                console.warn('Direct fetch failed, trying Supabase download...', fetchError);
            }

            // Attempt 2: Download via Supabase Storage API (handles paths better)
            // Extract path: find segment after /model-images/
            const path = imageUrl.split('/model-images/')[1];
            if (!path) throw new Error('Invalid Supabase Storage URL');

            const { data, error } = await supabase.storage
                .from('model-images')
                .download(path);

            if (error) throw error;
            if (!data) throw new Error('No data received from Supabase');

            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split('base64,')[1]);
                reader.readAsDataURL(data);
            });

        } catch (error) {
            console.error('Failed to download model image:', error);
            return null;
        }
    },

    // Delete a model
    async deleteModel(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('models')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Failed to delete model:', error);
            return false;
        }
        return true;
    }
};

// Assets storage functions
export const assetStorage = {
    // Get all saved assets
    async getAssets(shortlistedOnly = false): Promise<SavedAsset[]> {
        let query = supabase
            .from('assets')
            .select('*')
            .order('created_at', { ascending: false });

        if (shortlistedOnly) {
            query = query.eq('is_shortlisted', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch assets:', error);
            return [];
        }
        return data || [];
    },

    // Save an asset (also uploads to storage for persistency if needed)
    async saveAsset(asset: Omit<SavedAsset, 'id' | 'created_at'>): Promise<SavedAsset | null> {
        console.log('Saving asset to Supabase...');

        let finalImageUrl = asset.image_url;

        try {
            // If the image is a data URL (Base64), upload it first
            if (asset.image_url.startsWith('data:') || !asset.image_url.startsWith('http')) {
                console.log('Uploading generated asset to Storage...');
                const blob = await getBlobFromBase64(asset.image_url);
                const fileName = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

                const { error: uploadError } = await supabase.storage
                    .from('generated-assets')
                    .upload(fileName, blob, { contentType: 'image/jpeg' });

                if (uploadError) {
                    console.error('Asset Upload Failed:', uploadError);
                    alert(`Asset Backup Failed: ${uploadError.message}`);
                    return null;
                }

                const { data: urlData } = supabase.storage
                    .from('generated-assets')
                    .getPublicUrl(fileName);

                finalImageUrl = urlData.publicUrl;
                console.log('Asset uploaded to:', finalImageUrl);
            }

            const { data, error } = await supabase
                .from('assets')
                .insert([{ ...asset, image_url: finalImageUrl }])
                .select()
                .single();

            if (error) {
                console.error('Failed to save asset record:', error);
                return null;
            }
            return data;

        } catch (err) {
            console.error('Error in saveAsset:', err);
            return null;
        }
    },

    // Toggle shortlist status
    async toggleShortlist(id: string, isShortlisted: boolean): Promise<boolean> {
        const { error } = await supabase
            .from('assets')
            .update({ is_shortlisted: isShortlisted })
            .eq('id', id);

        if (error) {
            console.error('Failed to update shortlist:', error);
            return false;
        }
        return true;
    },

    // Delete an asset
    async deleteAsset(id: string, imageUrl?: string): Promise<boolean> {
        // 1. Delete from Storage if it's a Supabase URL
        if (imageUrl && imageUrl.includes('/generated-assets/')) {
            try {
                const path = imageUrl.split('/generated-assets/')[1];
                if (path) {
                    const { error: storageError } = await supabase.storage
                        .from('generated-assets')
                        .remove([path]);

                    if (storageError) {
                        console.warn('Failed to delete file from storage:', storageError);
                        // Continue to delete DB record anyway
                    } else {
                        console.log('Deleted file from storage:', path);
                    }
                }
            } catch (err) {
                console.warn('Error deleting file from storage:', err);
            }
        }

        // 2. Delete from Database
        const { error } = await supabase
            .from('assets')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Failed to delete asset:', error);
            return false;
        }
        return true;
    }
};
