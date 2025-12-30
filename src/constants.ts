
import { AvatarPreset, SettingPreset, AspectRatio, CameraAngle, CameraFraming, ModelPose } from './types';

// Using specific crop parameters to ensure thumbnails are always centered and valid
// Increased quality and ensure standard crop
const getUnsplashUrl = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=500&q=85`;

export const AVATARS: AvatarPreset[] = [
  {
    id: 'urban-male',
    name: 'Urban Male',
    description: 'A stylish young Black male model, athletic build, streetwear aesthetic.',
    imageUrl: getUnsplashUrl('1506794778202-cad84cf45f1d') 
  },
  {
    id: 'petite-female',
    name: 'Petite Editorial',
    description: 'A petite Asian female model, avant-garde makeup, high-fashion pose.',
    imageUrl: getUnsplashUrl('1534528741775-53994a69daeb')
  },
  {
    id: 'mature-classic',
    name: 'Mature Classic',
    description: 'A confident mature woman with silver hair, elegant and sophisticated posture.',
    imageUrl: getUnsplashUrl('1551196221-63c266994446')
  },
  {
    id: 'boho-female',
    name: 'Boho Spirit',
    description: 'A young female with wavy hair, natural look, sun-kissed skin.',
    imageUrl: getUnsplashUrl('1616683693504-3ea7e9ad6fec') // Updated for better visibility
  },
  {
    id: 'minimalist-androgynous',
    name: 'Androgynous',
    description: 'Androgynous model, sharp features, minimalist styling.',
    imageUrl: getUnsplashUrl('1500917293891-ef795e70e1f6')
  },
  {
    id: 'plus-glam',
    name: 'Plus Size Glam',
    description: 'Curvy female model, glamorous and bold expression.',
    imageUrl: getUnsplashUrl('1525134479668-1bee5c7c6845')
  }
];

export const SETTINGS: SettingPreset[] = [
  {
    id: 'clean-studio',
    name: 'Clean Studio',
    description: 'Professional high-key studio photography with a plain white infinity cove background.',
    imageUrl: getUnsplashUrl('1517841905240-472988babdf9') 
  },
  {
    id: 'studio-grey',
    name: 'Studio Grey',
    description: 'Professional studio with a seamless grey backdrop and dramatic softbox lighting.',
    imageUrl: getUnsplashUrl('1478720568477-152d9b164e63') 
  },
  {
    id: 'urban-street',
    name: 'Urban Street',
    description: 'Busy city street with blurred bokeh background, natural daylight.',
    imageUrl: getUnsplashUrl('1477959858617-67f85cf4f1df') 
  },
  {
    id: 'golden-hour-beach',
    name: 'Golden Beach',
    description: 'Sandy beach during sunset, warm golden lighting, ocean breeze.',
    imageUrl: getUnsplashUrl('1507525428034-b723cf961d3e') 
  },
  {
    id: 'luxury-interior',
    name: 'Luxury Hotel',
    description: 'High-end hotel lobby with marble floors and warm ambient light.',
    imageUrl: getUnsplashUrl('1566073771259-6a8506099945') 
  },
  {
    id: 'nature-forest',
    name: 'Deep Forest',
    description: 'Lush green forest, dappled sunlight through trees.',
    imageUrl: getUnsplashUrl('1448375240586-34e1a2b99c38') 
  }
];

export const RATIO_LABELS: Record<AspectRatio, string> = {
  [AspectRatio.Square]: 'Square (1:1)',
  [AspectRatio.Portrait]: 'Portrait (3:4)',
  [AspectRatio.Landscape]: 'Landscape (4:3)',
  [AspectRatio.Story]: 'Story (9:16)',
  [AspectRatio.Wide]: 'Banner (16:9)',
};

export const CAMERA_ANGLES: { id: CameraAngle; label: string }[] = [
  { id: 'eye-level', label: 'Eye Level' },
  { id: 'low-angle', label: 'Low Angle (From Below)' },
  { id: 'high-angle', label: 'High Angle (From Above)' },
  { id: 'side-angle', label: 'Side Profile' },
];

export const CAMERA_FRAMINGS: { id: CameraFraming; label: string }[] = [
  { id: 'wide', label: 'Wide' },
  { id: 'medium', label: 'Medium' },
  { id: 'close-up', label: 'Close Up' },
];

export const MODEL_POSES: { id: ModelPose; label: string }[] = [
  { id: 'generic', label: 'Generic' },
  { id: 'standing', label: 'Standing' },
  { id: 'walking', label: 'Walking' },
  { id: 'sitting', label: 'Sitting' },
  { id: 'leaning', label: 'Leaning' },
];
