
export enum AspectRatio {
  Square = "1:1",
  Portrait = "3:4",
  Landscape = "4:3",
  Story = "9:16",
  Wide = "16:9"
}

export type CameraAngle = 'eye-level' | 'low-angle' | 'high-angle' | 'side-angle';
export type CameraFraming = 'wide' | 'medium' | 'close-up';
export type ModelPose = 'generic' | 'standing' | 'walking' | 'sitting' | 'leaning';
export type ProductType = 'top' | 'bottom' | 'full-outfit' | 'accessory';

// Model Builder Types
export type BodyType = 'petite' | 'slim' | 'athletic' | 'curvy' | 'tall';
export type AgeRange = '20s' | '30s' | '40s' | '50+';
export type Ethnicity = 'south-asian' | 'east-asian' | 'black' | 'latina' | 'caucasian' | 'middle-eastern';
export type HairStyle = 'long-straight' | 'long-wavy' | 'natural-curly' | 'short-pixie' | 'braids';
export type ModelExpression = 'editorial' | 'soft-romantic' | 'bold-confident' | 'playful';

export interface AvatarPreset {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface SettingPreset {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface GeneratedAsset {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
  ratio: AspectRatio;
  // Metadata for remixing/resizing
  originalImage: string;
  avatarId?: string;
  modelId?: string; // ID of the saved model used for consistency
  settingId?: string;
  customPrompt: string;
  isShortlisted?: boolean;
  cameraAngle?: CameraAngle;
  cameraFraming?: CameraFraming;
  modelPose?: ModelPose;
}

export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';
