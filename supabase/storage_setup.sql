-- Lumière Fashion AI - Supabase Storage Setup
-- Run this in Supabase SQL Editor AFTER creating the 'model-images' bucket

-- Allow anonymous uploads to the 'model-images' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('model-images', 'model-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy to allow anyone to upload to the model-images bucket
CREATE POLICY "Allow public upload to model-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'model-images');

-- Policy to allow anyone to view objects in the model-images bucket (since it's public)
CREATE POLICY "Allow public select on model-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'model-images');

-- If you want to store generations in Supabase too:
-- Create another bucket 'generated-assets' and run these:
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-assets', 'generated-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public upload to generated-assets"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'generated-assets');

CREATE POLICY "Allow public select on generated-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-assets');
