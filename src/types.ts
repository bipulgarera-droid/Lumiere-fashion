
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
