
import { AvatarPreset, SettingPreset, AspectRatio, CameraAngle, CameraFraming, ModelPose, ProductType } from './types';

// Using specific crop parameters to ensure thumbnails are always centered and valid
const getUnsplashUrl = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=500&q=85`;

export const AVATARS: AvatarPreset[] = [
  {
    id: 'urban-male',
    name: 'Urban Male',
    description: 'A stylish young Black male model, athletic build, streetwear aesthetic. MUST look like a REAL PERSON photographed — natural skin texture with pores, authentic hair texture, genuine expression. Not AI/CGI.',
    imageUrl: getUnsplashUrl('1507003211169-0a1dd7228f2d') // Black male portrait
  },
  {
    id: 'petite-female',
    name: 'Petite Editorial',
    description: 'A petite Asian female model, avant-garde makeup, high-fashion pose. MUST look like a REAL PERSON photographed — natural skin texture with pores, authentic hair strands, genuine expression. Not AI/CGI.',
    imageUrl: getUnsplashUrl('1534528741775-53994a69daeb') // Asian female portrait
  },
  {
    id: 'mature-classic',
    name: 'Mature Classic',
    description: 'A confident mature woman with silver hair, elegant and sophisticated posture. MUST look like a REAL PERSON photographed — natural skin texture with fine lines, authentic silver hair, genuine expression. Not AI/CGI.',
    imageUrl: getUnsplashUrl('1544005313-94ddf0286df2') // Mature elegant woman
  },
  {
    id: 'boho-female',
    name: 'Boho Spirit',
    description: 'A young female with wavy hair, natural look, sun-kissed skin. MUST look like a REAL PERSON photographed — natural skin texture with freckles and imperfections, authentic wavy hair with flyaways, genuine expression. Not AI/CGI.',
    imageUrl: getUnsplashUrl('1494790108377-be9c29b29330') // Natural bohemian woman
  },
  {
    id: 'minimalist-androgynous',
    name: 'Androgynous',
    description: 'Androgynous model, sharp features, minimalist styling. MUST look like a REAL PERSON photographed — natural skin texture with pores, authentic features, genuine expression. Not AI/CGI.',
    imageUrl: getUnsplashUrl('1438761681033-6461ffad8d80') // Androgynous look
  },
  {
    id: 'plus-glam',
    name: 'Plus Size Glam',
    description: 'Curvy female model, glamorous and bold expression. MUST look like a REAL PERSON photographed — natural skin texture with pores, authentic body, genuine confident expression. Not AI/CGI.',
    imageUrl: getUnsplashUrl('1524504388940-b1c1722653e1') // Confident curvy woman
  }
];

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
    id: 'urban-street',
    name: 'Urban Street',
    description: 'Busy city street with blurred bokeh background, natural daylight. Must look like a REAL photograph taken on location — authentic street textures, real signage, natural pedestrians, genuine urban atmosphere. Not CGI or AI-rendered.',
    imageUrl: getUnsplashUrl('1480714378408-67cf0d13bc1b') // NYC street
  },
  {
    id: 'golden-hour-beach',
    name: 'Golden Beach',
    description: 'Sandy beach during sunset, warm golden lighting, ocean breeze. Must look like a REAL photograph taken on location — natural sand texture, authentic wave patterns, genuine sunset colors. Not CGI or AI-rendered.',
    imageUrl: getUnsplashUrl('1507525428034-b723cf961d3e') // Beach sunset
  },
  {
    id: 'luxury-interior',
    name: 'Luxury Hotel',
    description: 'High-end hotel lobby with marble floors and warm ambient light. Must look like a REAL photograph taken on location — authentic marble textures, genuine lighting reflections, real architectural details. Not CGI or AI-rendered.',
    imageUrl: getUnsplashUrl('1564501049412-61c2a3083791') // Luxury interior
  },
  {
    id: 'nature-forest',
    name: 'Deep Forest',
    description: 'Lush green forest, dappled sunlight through trees. Must look like a REAL photograph taken on location — natural leaf textures, authentic light rays, genuine forest depth. Not CGI or AI-rendered.',
    imageUrl: getUnsplashUrl('1441974231531-c6227db76b6e') // Forest with light
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
