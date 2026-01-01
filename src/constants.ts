
import { SettingPreset, AspectRatio, CameraAngle, CameraFraming, ModelPose, ProductType, BodyType, AgeRange, Ethnicity, HairStyle, ModelExpression } from './types';

// Using specific crop parameters to ensure thumbnails are always centered and valid
const getUnsplashUrl = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=500&q=85`;

// ============================================
// MODEL BUILDER OPTIONS
// ============================================

export const BODY_TYPES: { id: BodyType; label: string; prompt: string }[] = [
  { id: 'petite', label: 'Petite', prompt: 'petite, delicate frame, under 5\'4"' },
  { id: 'slim', label: 'Slim', prompt: 'slim, lean silhouette, elongated proportions' },
  { id: 'athletic', label: 'Athletic', prompt: 'athletic, toned physique, defined muscles' },
  { id: 'curvy', label: 'Curvy', prompt: 'curvy, full hips and bust, hourglass figure' },
  { id: 'tall', label: 'Tall', prompt: 'tall, statuesque, 5\'9" or taller, model proportions' },
];

export const AGE_RANGES: { id: AgeRange; label: string; prompt: string }[] = [
  { id: '20s', label: '20s', prompt: 'in her early to mid 20s, youthful and fresh-faced' },
  { id: '30s', label: '30s', prompt: 'in her 30s, at the peak of her career, confident' },
  { id: '40s', label: '40s', prompt: 'in her 40s, mature sophistication, refined beauty' },
  { id: '50+', label: '50+', prompt: 'in her 50s or older, elegant silver/grey hair, graceful aging' },
];

export const ETHNICITIES: { id: Ethnicity; label: string; prompt: string }[] = [
  { id: 'south-asian', label: 'South Asian', prompt: 'South Asian/Indian woman with warm brown skin, dark hair' },
  { id: 'east-asian', label: 'East Asian', prompt: 'East Asian woman (Korean/Japanese/Chinese features)' },
  { id: 'black', label: 'Black', prompt: 'Black/African descent woman with rich dark skin' },
  { id: 'latina', label: 'Latina', prompt: 'Latina/Hispanic woman with warm undertones' },
  { id: 'caucasian', label: 'Caucasian', prompt: 'Caucasian/European woman with fair to medium skin' },
  { id: 'middle-eastern', label: 'Middle Eastern', prompt: 'Middle Eastern/Arab woman with olive skin' },
];

export const HAIR_STYLES: { id: HairStyle; label: string; prompt: string }[] = [
  { id: 'long-straight', label: 'Long Straight', prompt: 'long straight hair, sleek and polished' },
  { id: 'long-wavy', label: 'Long Wavy', prompt: 'long wavy hair, flowing and voluminous' },
  { id: 'natural-curly', label: 'Natural Curly', prompt: 'natural curly/coily hair, textured and voluminous' },
  { id: 'short-pixie', label: 'Short/Pixie', prompt: 'short pixie cut or cropped hair, modern and edgy' },
  { id: 'braids', label: 'Braids', prompt: 'braided hair, intricate braids or locs' },
];

export const MODEL_EXPRESSIONS: { id: ModelExpression; label: string; prompt: string }[] = [
  { id: 'editorial', label: 'Editorial', prompt: 'serious editorial expression, intense gaze, high-fashion' },
  { id: 'soft-romantic', label: 'Soft Romantic', prompt: 'soft romantic expression, dreamy and gentle' },
  { id: 'bold-confident', label: 'Bold Confident', prompt: 'bold confident expression, powerful and commanding' },
  { id: 'playful', label: 'Playful', prompt: 'playful joyful expression, natural smile, approachable' },
];

// Photorealism suffix for all model descriptions
export const MODEL_REALISM_SUFFIX = 'MUST look like a REAL PERSON photographed — natural skin texture with pores, authentic hair, genuine expression. Not AI/CGI.';

export const SETTINGS: SettingPreset[] = [
  {
    id: 'clean-studio',
    name: 'Clean Studio',
    description: 'Professional high-key studio photography with a plain white infinity cove background. CRITICAL: The seamless backdrop must fill the ENTIRE frame edge-to-edge — no visible edges, no backdrop paper seams, no studio equipment, no runout. Must look like a REAL studio photograph, not AI-rendered.',
    imageUrl: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?auto=format&fit=crop&w=400&h=300&q=85' // White studio backdrop
  },
  {
    id: 'studio-grey',
    name: 'Studio Grey',
    description: 'Professional studio with a seamless grey backdrop and dramatic softbox lighting. CRITICAL: The grey backdrop must fill the ENTIRE frame edge-to-edge — no visible edges, no backdrop paper seams, no studio equipment, no runout. Must look like a REAL studio photograph, not AI-rendered.',
    imageUrl: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=400&h=300&q=85' // Grey studio
  },
  {
    id: 'studio-red',
    name: 'Studio Red',
    description: 'Professional studio with a seamless vibrant red backdrop. CRITICAL: The red backdrop must fill the ENTIRE frame edge-to-edge — no visible edges, no backdrop paper seams, no studio equipment, no runout. Must look like a REAL studio photograph, not AI-rendered.',
    imageUrl: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=400&h=300&q=85' // Red gradient placeholder
  },
  {
    id: 'studio-brown',
    name: 'Studio Brown',
    description: 'Professional studio with a seamless warm chocolate brown/terracotta backdrop. CRITICAL: The brown backdrop must fill the ENTIRE frame edge-to-edge — no visible edges, no backdrop paper seams, no studio equipment, no runout. Must look like a REAL studio photograph, not AI-rendered.',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&h=300&q=85' // Brown backdrop placeholder
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

export const PRODUCT_TYPES: { id: ProductType; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'full-outfit', label: 'Full Outfit' },
  { id: 'accessory', label: 'Accessory' },
];
