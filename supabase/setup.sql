-- Lumière Fashion AI - Supabase Database Setup
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create models table (for saved model presets)
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assets table (for generated images)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  prompt TEXT,
  model_id UUID REFERENCES models(id) ON DELETE SET NULL,
  environment VARCHAR(255),
  camera_angle VARCHAR(100),
  camera_framing VARCHAR(100),
  model_pose VARCHAR(100),
  aspect_ratio VARCHAR(50),
  is_shortlisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_shortlisted ON assets(is_shortlisted);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_models_created_at ON models(created_at DESC);

-- Enable Row Level Security (RLS)
-- For now, allow all operations (public access)
-- In production, you'd add user authentication and restrict access

ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (for development)
CREATE POLICY "Allow public access to models" ON models
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to assets" ON assets
  FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for model images
-- Note: Run this in the Supabase Dashboard under Storage > Create Bucket
-- Bucket name: model-images
-- Public bucket: Yes
