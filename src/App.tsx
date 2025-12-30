
import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  Check,
  Loader2,
  Trash2,
  History,
  Download,
  Heart,
  Edit3,
  Maximize2,
  Camera,
  Focus,
  User,
  RefreshCw,
  ChevronRight,
  Type,
  ChevronDown
} from 'lucide-react';

import Header from './components/Header';
import AssetCard from './components/AssetCard';
import ModelLibrary from './components/ModelLibrary';
import DebugConsole from './components/DebugConsole';
import { modelLibrary, assetStorage, SavedModel, SavedAsset } from './services/supabaseService';
import {
  AVATARS,
  SETTINGS,
  RATIO_LABELS,
  CAMERA_ANGLES,
  CAMERA_FRAMINGS,
  MODEL_POSES,
  PRODUCT_TYPES
} from './constants';
import {
  GeneratedAsset,
  AvatarPreset,
  SettingPreset,
  AspectRatio,
  GenerationStatus,
  CameraAngle,
  CameraFraming,
  ModelPose,
  ProductType
} from './types';
import { generateFashionAssets } from './services/geminiService';
import { upscaleImage } from './services/upscaleService';

// Type for reference model (saved model used for consistency)
type ReferenceModel = SavedModel | null;

const App: React.FC = () => {
  // Core Configuration State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // New State: Preserve Mode
  const [preserveOriginal, setPreserveOriginal] = useState<boolean>(false);
  // New State: High Fidelity Mode (Color Accuracy)
  const [highFidelityMode, setHighFidelityMode] = useState<boolean>(false);

  // Camera & Pose Controls (Left Sidebar - Global)
  const [selectedAngle, setSelectedAngle] = useState<CameraAngle>('eye-level');
  const [selectedFraming, setSelectedFraming] = useState<CameraFraming>('wide');
  const [selectedPose, setSelectedPose] = useState<ModelPose>('generic');
  const [selectedProductType, setSelectedProductType] = useState<ProductType>('top');

  // Refine Controls (Right Panel - Local)
  const [refineAngle, setRefineAngle] = useState<CameraAngle>('eye-level');
  const [refineFraming, setRefineFraming] = useState<CameraFraming>('medium');
  const [refinePose, setRefinePose] = useState<ModelPose>('standing');

  // Conditional Configuration (Disabled if Preserve Mode is ON)
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarPreset | null>(AVATARS[0]);
  const [selectedSetting, setSelectedSetting] = useState<SettingPreset | null>(SETTINGS[0]);

  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(AspectRatio.Portrait);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [generateCount, setGenerateCount] = useState<number>(3); // 1-3 images

  // App State
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [activeAsset, setActiveAsset] = useState<GeneratedAsset | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'shortlist'>('all');
  const [isLoaded, setIsLoaded] = useState(false);

  // Saved model for consistency (from Supabase)
  const [savedReferenceModel, setSavedReferenceModel] = useState<ReferenceModel>(null);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

  // Text Overlay State
  const [overlayProductName, setOverlayProductName] = useState('');
  const [overlayOriginalPrice, setOverlayOriginalPrice] = useState('');
  const [overlaySalePrice, setOverlaySalePrice] = useState('');
  const [overlayPosition, setOverlayPosition] = useState<'top-left' | 'center' | 'bottom-left'>('top-left');
  const [overlayWatermark, setOverlayWatermark] = useState('');
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [overlayTextColor, setOverlayTextColor] = useState('#ffffff'); // Default white

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved assets from Supabase on mount
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const saved = await assetStorage.getAssets();
        // Convert snake_case from DB to camelCase for App
        const parsed: GeneratedAsset[] = saved.map(a => ({
          id: a.id,
          imageUrl: a.image_url,
          prompt: a.prompt,
          timestamp: new Date(a.created_at).getTime(),
          ratio: (a.aspect_ratio as AspectRatio) || AspectRatio.Portrait,
          // Note: Start new sessions clean or handle 'originalImage' specifically if needed.
          // For now, we load previous generations but they might not be fully remixable 
          // if we don't store the massive original base64. 
          // Current solution: store public URL as originalImage if it was an asset re-use, 
          // or leave undefined if we can't recover the source.
          originalImage: a.image_url, // Use the asset itself as source for remixing history
          avatarId: undefined, // Metadata could be expanded
          modelId: a.model_id,
          settingId: a.environment,
          cameraAngle: a.camera_angle as CameraAngle,
          cameraFraming: a.camera_framing as CameraFraming,
          modelPose: a.model_pose as ModelPose,
          isShortlisted: a.is_shortlisted,
          customPrompt: ''
        }));

        setGeneratedAssets(parsed);
        if (parsed.length > 0) setActiveAsset(parsed[0]);
      } catch (error) {
        console.error('Failed to load assets from Supabase:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadAssets();
  }, []);

  // Filter assets based on tab
  const displayedAssets = activeTab === 'shortlist'
    ? generatedAssets.filter(a => a.isShortlisted)
    : generatedAssets;

  // Sync refine controls when active asset changes
  useEffect(() => {
    if (activeAsset) {
      if (activeAsset.cameraAngle) setRefineAngle(activeAsset.cameraAngle);
      if (activeAsset.cameraFraming) setRefineFraming(activeAsset.cameraFraming);
      if (activeAsset.modelPose) setRefinePose(activeAsset.modelPose);
    }
  }, [activeAsset]);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const clearUpload = () => {
    setUploadedImage(null);
  };

  // Save current generated asset as a reusable model
  const handleSaveAsModel = async (name: string, description: string) => {
    if (!activeAsset?.imageUrl) {
      console.error('No active asset to save as model');
      return;
    }
    const saved = await modelLibrary.saveModel(name, description, activeAsset.imageUrl);
    if (saved) {
      setSavedReferenceModel(saved);
    }
  };

  // Select a saved model for consistent generation
  const handleSelectSavedModel = (model: SavedModel) => {
    setSavedReferenceModel(model);
    // Clear the preset avatar selection when using a saved model
    setSelectedAvatar(null);
  };

  // Helper to translate UI options into powerful prompt instructions
  const getDetailedAngleDescription = (angle: CameraAngle): string => {
    switch (angle) {
      case 'eye-level': return "EYE LEVEL, camera positioned at the subject's eye height, horizontally straight - NOT looking up, NOT looking down";
      case 'low-angle': return "LOW ANGLE, camera placed BELOW the subject looking UP at them, worm's-eye perspective";
      case 'high-angle': return "HIGH ANGLE, camera placed ABOVE the subject looking DOWN at them, bird's-eye perspective";
      case 'side-angle': return "SIDE PROFILE, 90-degree lateral view of the subject, profile silhouette";
      default: return "EYE LEVEL, camera at subject's eye height, horizontally straight";
    }
  };

  // Original Generation Logic
  const handleGenerate = async (overrideRatio?: AspectRatio) => {
    if (!uploadedImage) {
      alert("Please upload a product image first.");
      return;
    }

    // Validate selections if not in preserve mode
    // Must have a subject (Avatar OR Saved Model) and a Setting
    if (!preserveOriginal && ((!selectedAvatar && !savedReferenceModel) || !selectedSetting)) {
      alert("Please select a Model and an Environment.");
      return;
    }

    const targetRatio = overrideRatio || selectedRatio;
    setStatus('generating');

    // Initialize loading state
    setStatus('generating');
    if (savedReferenceModel) {
      console.log('Generating with Character Consistency:', savedReferenceModel.name);
    }

    // Define detailed variables for prompt
    const detailedAngle = getDetailedAngleDescription(selectedAngle);
    // Safe lookup for display labels
    // Smart framing that adapts based on PRODUCT TYPE
    const getSmartFramingDescription = (framing: CameraFraming, productType: ProductType): string => {
      // Matrix: [Product Type][Framing] => Description
      const framingMatrix: Record<ProductType, Record<CameraFraming, string>> = {
        'top': {
          'wide': 'full body shot showing the model head to feet',
          'medium': 'medium shot framing from waist up, showing the top/shirt prominently',
          'close-up': 'close-up shot from chest up, showcasing the top neckline, fabric, and fit'
        },
        'bottom': {
          'wide': 'full body shot showing head to feet, with pants/bottoms clearly visible',
          'medium': 'medium shot framing from above waist to below knees, focusing on the pants/bottoms fit and style',
          'close-up': 'detailed shot from waist to mid-thigh, highlighting the pants/bottoms waistband, pockets, and fabric texture'
        },
        'full-outfit': {
          'wide': 'full body editorial shot showing the complete outfit from head to feet with environment',
          'medium': 'three-quarter shot from head to below knees, showing most of the outfit',
          'close-up': 'upper body shot focusing on outfit coordination, fabric details, and styling'
        },
        'accessory': {
          'wide': 'lifestyle shot showing the accessory in context with the model',
          'medium': 'product-focused shot with the accessory as the clear focal point',
          'close-up': 'detailed product shot highlighting the accessory texture, material, and craftsmanship'
        }
      };
      return framingMatrix[productType][framing] || 'medium fashion shot';
    };

    const framingLabel = getSmartFramingDescription(selectedFraming, selectedProductType);
    const poseLabel = MODEL_POSES.find(p => p.id === selectedPose)?.label || 'Standing';

    // Product priority instruction - ensures the product isn't cropped out
    const productPriorityNote = 'IMPORTANT: The PRODUCT/GARMENT from the reference image must ALWAYS be fully visible. Adjust framing as needed to ensure the entire garment is shown.';

    // PRODUCT INTEGRITY - NON-NEGOTIABLE (applies to ALL generation types)
    const productIntegrityNote = `
      PRODUCT INTEGRITY (NON-NEGOTIABLE):
      The product from the reference image (garment, accessory, shoes, bag, etc.) must be reproduced with EXACT fidelity:
      - EXACT COLOR: Match the precise hex values, hue, saturation, and brightness. No color shifting, no lightening, no darkening.
      - EXACT TEXTURE: Preserve fabric weave, leather grain, surface detail, sheen, and material properties.
      - EXACT PATTERN: If there are prints, stripes, logos, hardware, or gradients, reproduce them identically.
      - EXACT SHAPE: Maintain the product's silhouette, cut, construction, and design details.
      This is the single most important requirement. The product IS what is being photographed.
    `.trim();

    try {
      let modelBase64: string | undefined;

      // 1. Fetch Model Image if needed
      if (savedReferenceModel) {
        modelBase64 = await modelLibrary.getModelImageBase64(savedReferenceModel.image_url) || undefined;

        if (!modelBase64) {
          console.warn('Failed to fetch saved model image. Falling back to text description.');
          // Optional: Alert user
          // alert("Could not download model image. improved consistency will be disabled.");
        }
      }

      // 2. Construct Prompt (Now that we know if we have the image)
      let fullPrompt = '';

      // High Fidelity Styles (Only used if mode is ON)
      const highFiStyle = `STYLE: Modern High-End Digital Photography. Phase One XF IQ4 150MP, 80mm f/2.8 lens.
           LIGHTING: Professional Studio Lighting. Softbox lighting setup, neutral 5600K white balance.
           COLOR: 100% ACCURATE COLOR REPRODUCTION. Do not apply vintage filters, do not color grade, do not add film grain. 
           The color of the garment must match the input image HEX code exactly. High fidelity textures.`;

      const highFiAvoid = 'Avoid: Color shifting, vintage tints, cloudy haze, low contrast.';

      // PHOTOREALISM - Anti-AI artifacts (used in ALL prompts)
      const photoRealismNote = `
        PHOTOREALISM (CRITICAL - APPLIES TO EVERYTHING):
        
        MODEL must look like a REAL PERSON photographed with a camera:
        - SKIN: Natural texture with visible pores, fine lines, subtle imperfections. No plastic/airbrushed skin.
        - HAIR: Natural texture with individual strands, flyaways. No smooth CGI hair.
        - EYES: Natural highlights and realistic iris detail. No uncanny/glassy eyes.
        - BODY PROPORTIONS: Realistic, healthy proportions. Arms must have natural thickness and muscle definition. No unnaturally thin limbs, no elongated fingers, no distorted hands. Proper joint placement.
        - HANDS/FINGERS: Correct number of fingers (5 per hand), natural hand poses, proper finger proportions.
        
        LIGHTING must look like REAL PHOTOGRAPHY:
        - Natural light sources (sun, window, softbox) with realistic shadows and highlights.
        - Proper light falloff and color temperature.
        - No flat CG lighting, no unrealistic rim lights, no over-exposed artificial glow.
        
        ENVIRONMENT must look like a REAL LOCATION photographed on-site:
        - TEXTURES: Authentic materials (real concrete, real marble, real sand, real leaves).
        - ATMOSPHERE: Real depth, real bokeh, genuine environmental details.
        
        AVOID: CGI look, video game aesthetic, plastic appearance, uncanny valley, over-rendered, artificial, AI-generated appearance, unrealistic body proportions.
      `.trim();

      // STUDIO RUNOUT PREVENTION - Applies when Studio Grey or Clean Studio is selected
      const isStudioSetting = selectedSetting?.id === 'studio-grey' || selectedSetting?.id === 'clean-studio';
      const studioRunoutNote = isStudioSetting ? `
        STUDIO BACKDROP REQUIREMENT (ABSOLUTELY CRITICAL):
        The studio backdrop must be an INFINITE, UNBROKEN FIELD of color.
        1. NO VISIBLE CORNERS or studio architecture (walls, floors meeting walls).
        2. NO VISIBLE EQUIPMENT: Softboxes, stands, cables, and reflectors MUST NOT be visible. MASK THEM OUT.
        3. NO ROLLED PAPER EDGES or "runout".
        4. The entire background from edge-to-edge must be a pure, seamless, infinite ${selectedSetting?.id === 'studio-grey' ? 'grey' : 'white'} cyclorama.
        The image must look like it was cropped from the center of a massive studio with no edges visible.
      `.trim() : '';

      // ENVIRONMENT LIGHTING INTEGRATION - For exterior/location settings
      const isExteriorSetting = selectedSetting?.id && !isStudioSetting;
      const environmentLightingNote = isExteriorSetting ? `
        ENVIRONMENT LIGHTING INTEGRATION (CRITICAL):
        The model must be lit BY the environment — as if actually present at the location.
        - SHADOWS: Environment light sources must cast realistic shadows on the model (sun position, window light, etc.)
        - COLOR CAST: Environment color must reflect onto the model (warm golden tones at beach sunset, green tint in forest, etc.)
        - RIM LIGHTING: Natural rim/edge lighting from environment light sources
        - REFLECTIONS: Subtle environment reflections on skin and fabric surfaces
        - GEOMETRIC CONSISTENCY: Light direction on model must match environment light direction
        The model must look like they were ACTUALLY PHOTOGRAPHED at this location, not composited in.
      `.trim() : '';

      if (preserveOriginal) {
        // Mode: Preserve original subject/bg, just change camera params
        fullPrompt = `
          COMPOSITION INSTRUCTION: Generate a ${framingLabel} shot.
          CAMERA ANGLE: ${detailedAngle}.
          SUBJECT POSE: The model should be ${poseLabel}.
          
          TASK: Editorial fashion photography. Retain the EXACT subject, clothing, and background from the input image.
          
          CRITICAL: Do NOT change the model's identity or the environment. Only adjust the camera perspective and framing as requested above.
          
          ${productIntegrityNote}
          
          ${productPriorityNote}
          
          ${highFidelityMode
            ? highFiStyle
            : `CRITICAL OUTPUT REQUIREMENT: Generate a BORDERLESS, FULL-BLEED image with NO FRAMES. The photograph must fill the entire canvas edge-to-edge. NO film borders, NO film strips, NO sprocket holes, NO Kodak/Portra film frames, NO date stamps, NO margins of any color.
           STYLE INSPIRATION ONLY (do NOT add film frames): Natural light aesthetic inspired by 35mm film photography. Authentic skin texture, candid movement, subtle grain.`
          }
          
          ${photoRealismNote}
          
          ${studioRunoutNote}
          ${environmentLightingNote}
          
          ${customPrompt ? `ADDITIONAL INSTRUCTIONS: ${customPrompt}` : ''}
        `.trim();
      } else {
        // Mode: New Generation (Replace Model/Env)
        const shouldUseConsistency = !!(savedReferenceModel && modelBase64);

        fullPrompt = `
           COMPOSITION INSTRUCTION: Create a ${framingLabel} fashion shot.
           CAMERA ANGLE: ${detailedAngle}.
           
           TASK: Editorial fashion photography.
           Generate a raw, authentic photo of ${shouldUseConsistency ? 'the SPECIFIED MODEL' : 'the TARGET MODEL'} wearing the garment shown in the reference image.
           
           ${shouldUseConsistency
            ? `CHARACTER CONSISTENCY (FACE/BODY ONLY): Use the identity of the model in the provided second reference image.
               CRITICAL RULE: You MUST IGNORE the pose, background, clothing, and lighting of the reference model image.
               - Extract ONLY the facial features and body type.
               - Place this model into the NEW pose and NEW environment defined below.
               - The output must be a COMPLETELY NEW image, NOT a copy of the reference.`
            : `TARGET MODEL: ${selectedAvatar?.description || 'A fashion model'}.`
          }
           
           POSE: ${poseLabel}.
           ${productIntegrityNote}
           ${productPriorityNote}
           
           SETTING: ${selectedSetting?.description}.
           
           ${highFidelityMode
            ? highFiStyle
            : 'CRITICAL OUTPUT REQUIREMENT: Generate a BORDERLESS, FULL-BLEED image with NO FRAMES. NO film borders, NO film strips, NO sprocket holes, NO Kodak/Portra film frames, NO date stamps, NO margins. STYLE INSPIRATION ONLY: Natural light aesthetic inspired by 35mm film photography with subtle grain.'
          }
           
           ${highFidelityMode
            ? highFiAvoid
            : 'Avoid: ANY borders, frames, film strips, film sprockets, date stamps, film edges, white margins, black margins, text, watermarks, branding, CGI, airbrushed, plastic skin.'
          }
           
           ${photoRealismNote}
           
           ${studioRunoutNote}
           ${environmentLightingNote}
           
           ${customPrompt ? `ADDITIONAL INSTRUCTIONS: ${customPrompt}` : ''}
           
           IMPORTANT: IMAGE MUST BE 100% BORDERLESS. NO FILM FRAMES. NO KODAK BORDERS.
         `.trim();
      }

      // 3. Generate Assets
      const generatedImages = await generateFashionAssets(
        uploadedImage,
        fullPrompt,
        targetRatio,
        generateCount, // User-selected count (1-3)
        modelBase64 // Pass the base64 string directly (only if fetched)
      );

      // Create new assets locally first for immediate UI update
      const newAssets: GeneratedAsset[] = generatedImages.map((img, index) => ({
        id: `${Date.now()}-${index}`, // Temp ID until saved
        imageUrl: img,
        prompt: fullPrompt,
        timestamp: Date.now(),
        ratio: targetRatio,
        originalImage: uploadedImage,
        avatarId: preserveOriginal ? undefined : (savedReferenceModel ? undefined : selectedAvatar?.id),
        modelId: savedReferenceModel?.id,
        settingId: preserveOriginal ? undefined : selectedSetting?.id,
        cameraAngle: selectedAngle,
        cameraFraming: selectedFraming,
        modelPose: selectedPose,
        customPrompt: customPrompt,
        isShortlisted: false
      }));

      setGeneratedAssets(prev => [...newAssets, ...prev]);
      setActiveAsset(newAssets[0]);
      setStatus('success');
      setActiveTab('all');

      // Persist to Supabase in background
      newAssets.forEach(async (asset) => {
        try {
          // Upload and Save
          await assetStorage.saveAsset({
            image_url: asset.imageUrl,
            prompt: asset.prompt,
            model_id: asset.modelId,
            environment: asset.settingId,
            camera_angle: asset.cameraAngle,
            camera_framing: asset.cameraFraming,
            model_pose: asset.modelPose,
            aspect_ratio: asset.ratio,
            is_shortlisted: false
          });
          // Note: We could update the local asset ID with the real DB ID here if needed
        } catch (err) {
          console.error("Failed to persist asset:", err);
        }
      });

    } catch (error) {
      console.error('Generation Error:', error);
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Generation Failed: ${errorMessage}`);
    } finally {
      setTimeout(() => {
        setStatus(prev => prev === 'error' ? 'error' : 'idle');
      }, 2000);
    }
  };

  // Variation Logic (Resize)
  const handleVariation = async (targetRatio: AspectRatio) => {
    if (!activeAsset) return;

    setStatus('generating');

    const variationPrompt = `
      STRICT IMAGE RESIZING TASK.
      
      Goal: Convert the input image to aspect ratio ${targetRatio}.
      
      RULES:
      1. PRESERVE THE IMAGE: You must maintain the EXACT model identity, the EXACT pose, the EXACT garment details, and the EXACT lighting of the input image.
      2. NO RE-IMAGINING: Do not change the angle. Do not change the face. Do not change the colors.
      3. OUTPAINT/CROP: Only extend the background (outpaint) or crop the image intelligently to fit the new ${targetRatio} frame.
      
      The result should look identical to the original, just with different dimensions.
    `.trim();

    try {
      let modelBase64: string | undefined;
      if (savedReferenceModel) {
        modelBase64 = await modelLibrary.getModelImageBase64(savedReferenceModel.image_url) || undefined;
      }

      const generatedImages = await generateFashionAssets(
        activeAsset.imageUrl,
        variationPrompt,
        targetRatio,
        1, // Explicitly 1 for strict variation
        modelBase64
      );

      const newAssets: GeneratedAsset[] = generatedImages.map((img, index) => ({
        id: `${Date.now()}-${index}-var`,
        imageUrl: img,
        prompt: variationPrompt,
        timestamp: Date.now(),
        ratio: targetRatio,
        originalImage: activeAsset.originalImage,
        avatarId: activeAsset.avatarId,
        modelId: savedReferenceModel?.id || activeAsset.modelId,
        settingId: activeAsset.settingId,
        cameraAngle: activeAsset.cameraAngle,
        cameraFraming: activeAsset.cameraFraming,
        modelPose: activeAsset.modelPose,
        customPrompt: activeAsset.customPrompt,
        isShortlisted: false
      }));

      setGeneratedAssets(prev => [...newAssets, ...prev]);
      setActiveAsset(newAssets[0]);
      setStatus('success');

      // Persist to Supabase
      newAssets.forEach(async (asset) => {
        await assetStorage.saveAsset({
          image_url: asset.imageUrl,
          prompt: asset.prompt,
          model_id: asset.modelId,
          environment: asset.settingId,
          camera_angle: asset.cameraAngle,
          camera_framing: asset.cameraFraming,
          model_pose: asset.modelPose,
          aspect_ratio: asset.ratio,
          is_shortlisted: false
        });
      });

    } catch (error) {
      console.error(error);
      setStatus('error');
      alert("Failed to create variation.");
    } finally {
      setTimeout(() => {
        if (status !== 'error') setStatus('idle');
      }, 1000);
    }
  };

  // Refine Logic (Change Camera/Pose of existing image)
  const handleRefine = async () => {
    if (!activeAsset) return;

    setStatus('generating');

    // Use smart framing based on product type (inherit from left panel)
    const getSmartFramingForRefine = (framing: CameraFraming): string => {
      const matrix: Record<ProductType, Record<CameraFraming, string>> = {
        'top': {
          'wide': 'full body shot head to feet',
          'medium': 'waist up shot',
          'close-up': 'chest and shoulders up'
        },
        'bottom': {
          'wide': 'full body head to feet',
          'medium': 'waist to below knees',
          'close-up': 'waist to mid-thigh'
        },
        'full-outfit': {
          'wide': 'full body with environment',
          'medium': 'head to knees',
          'close-up': 'upper body'
        },
        'accessory': {
          'wide': 'lifestyle context',
          'medium': 'product focus',
          'close-up': 'product detail'
        }
      };
      return matrix[selectedProductType][framing];
    };

    const smartFraming = getSmartFramingForRefine(refineFraming);

    // Define notes locally for Refine scope using activeAsset.settingId
    const photoRealismNote = `
        PHOTOREALISM (CRITICAL - APPLIES TO EVERYTHING):
        MODEL must look like a REAL PERSON photographed with a camera:
        - SKIN: Natural texture with visible pores, fine lines. No plastic skin.
        - HAIR: Natural texture with individual strands. No smooth CGI hair.
        - EYES: Natural highlights and realistic iris detail. No uncanny eyes.
        - BODY PROPORTIONS: Realistic, healthy proportions. Arms must have natural thickness.
        - LIGHTING: Natural light sources (sun, window, softbox) with realistic shadows.
        AVOID: CGI look, video game aesthetic, plastic appearance, uncanny valley, over-rendered, artificial.
    `.trim();

    const isStudioRefine = activeAsset.settingId === 'clean-studio' || activeAsset.settingId === 'studio-grey';
    const studioRunoutNote = isStudioRefine ? `
        STUDIO BACKDROP REQUIREMENT (ABSOLUTELY CRITICAL):
        The studio backdrop must be an INFINITE, UNBROKEN FIELD of color.
        1. NO VISIBLE CORNERS or studio architecture (walls, floors meeting walls).
        2. NO VISIBLE EQUIPMENT: Softboxes, stands, cables, and reflectors MUST NOT be visible. MASK THEM OUT.
        3. NO ROLLED PAPER EDGES or "runout".
        4. The entire background from edge-to-edge must be a pure, seamless, infinite ${activeAsset.settingId === 'studio-grey' ? 'grey' : 'white'} cyclorama.
        The image must look like it was cropped from the center of a massive studio with no edges visible.
    `.trim() : '';

    const isOuterRefine = activeAsset.settingId && !isStudioRefine;
    const environmentLightingNote = isOuterRefine ? `
        ENVIRONMENT LIGHTING INTEGRATION (CRITICAL):
        The model must be lit BY the environment — as if actually present at the location.
        - SHADOWS: Environment light sources must cast realistic shadows on the model
        - COLOR CAST: Environment color must reflect onto the model
        - RIM LIGHTING: Natural rim/edge lighting from environment
        - GEOMETRIC CONSISTENCY: Light direction on model must match environment
    `.trim() : '';
    const poseLabel = MODEL_POSES.find(p => p.id === refinePose)?.label || 'standing';
    const detailedAngle = getDetailedAngleDescription(refineAngle);

    const refinePrompt = `
      RE-SHOOT TASK: Create a NEW photograph with DIFFERENT camera settings.
      
      ⚠️ THESE ARE THE CHANGES - THE OUTPUT MUST BE DIFFERENT FROM THE INPUT:
      
      1. CAMERA ANGLE → ${detailedAngle}
         The camera position MUST change. Shoot from ${detailedAngle}.
         
      2. FRAMING/ZOOM → ${smartFraming}
         The crop MUST change. Frame the shot as ${smartFraming}.
         If this is tighter than the input (e.g., "waist up" from a full body), ZOOM IN.
         If this is wider than the input, ZOOM OUT.
         
      3. MODEL POSE → ${poseLabel}
         The pose MUST change to ${poseLabel}.
      
      THE OUTPUT IMAGE MUST VISUALLY DIFFER FROM THE INPUT based on the above.
      If the input is low-angle and I requested eye-level, the output MUST be eye-level.
      If the input is wide and I requested close-up, the output MUST be cropped closer.
      
      ———————————————————————
      PRODUCT INTEGRITY (NON-NEGOTIABLE):
      The product (garment, accessory, shoes) must be reproduced with EXACT fidelity:
      - EXACT COLOR (no shifting), EXACT TEXTURE, EXACT PATTERN, EXACT SHAPE.
      
      PRESERVE:
      - Same model identity (face, body)
      - Similar environment aesthetic
      
      ${photoRealismNote}
      
      ${studioRunoutNote}
      ${environmentLightingNote}
      ———————————————————————
      
      FINAL OUTPUT: A fashion photo shot from ${detailedAngle} angle with ${smartFraming} framing, model in ${poseLabel} pose.
      
      IMPORTANT: IMAGE MUST BE 100% BORDERLESS. NO FILM FRAMES. NO KODAK BORDERS.
    `.trim();

    try {
      let modelBase64: string | undefined;
      if (savedReferenceModel) {
        modelBase64 = await modelLibrary.getModelImageBase64(savedReferenceModel.image_url) || undefined;
      }

      const generatedImages = await generateFashionAssets(
        activeAsset.imageUrl,
        refinePrompt,
        activeAsset.ratio, // Keep current ratio
        1, // Explicitly 1 for strict refinement
        modelBase64
      );

      const newAssets: GeneratedAsset[] = generatedImages.map((img, index) => ({
        id: `${Date.now()}-${index}-refine`,
        imageUrl: img,
        prompt: refinePrompt,
        timestamp: Date.now(),
        ratio: activeAsset.ratio,
        originalImage: activeAsset.originalImage,
        avatarId: activeAsset.avatarId,
        modelId: savedReferenceModel?.id || activeAsset.modelId,
        settingId: activeAsset.settingId,
        cameraAngle: refineAngle,
        cameraFraming: refineFraming,
        modelPose: refinePose,
        customPrompt: activeAsset.customPrompt,
        isShortlisted: false
      }));

      setGeneratedAssets(prev => [...newAssets, ...prev]);
      setActiveAsset(newAssets[0]);
      setStatus('success');

      // Persist to Supabase
      newAssets.forEach(async (asset) => {
        await assetStorage.saveAsset({
          image_url: asset.imageUrl,
          prompt: asset.prompt,
          model_id: asset.modelId,
          environment: asset.settingId,
          camera_angle: asset.cameraAngle,
          camera_framing: asset.cameraFraming,
          model_pose: asset.modelPose,
          aspect_ratio: asset.ratio,
          is_shortlisted: false
        });
      });

    } catch (error) {
      console.error(error);
      setStatus('error');
      alert("Failed to refine asset.");
    } finally {
      setTimeout(() => {
        if (status !== 'error') setStatus('idle');
      }, 1000);
    }
  };

  const toggleShortlist = async (assetId: string) => {
    // Optimistic UI Update
    setGeneratedAssets(prev => prev.map(asset => {
      if (asset.id === assetId) {
        // Persist change
        // Note: If ID is temporary (not yet sync with DB), this might fail in DB, 
        // but since we don't fully await ID sync yet, this is a limitation.
        // In real app, we'd replace temp ID with DB ID.
        // For now, we assume if it loaded from DB, it has a UUID. 
        // If it's fresh, we might not be able to update it in DB until refresh.
        // Simplest fix: Just allow UI toggle for now.
        assetStorage.toggleShortlist(assetId, !asset.isShortlisted);
        return { ...asset, isShortlisted: !asset.isShortlisted };
      }
      return asset;
    }));

    if (activeAsset?.id === assetId) {
      setActiveAsset(prev => prev ? { ...prev, isShortlisted: !prev.isShortlisted } : null);
    }
  };

  const handleRemix = async (asset: GeneratedAsset) => {
    setUploadedImage(asset.originalImage);

    // Handle Model Consistency
    if (asset.modelId) {
      // Fetch models to find the one used
      const models = await modelLibrary.getModels();
      const model = models.find(m => m.id === asset.modelId);
      if (model) {
        setSavedReferenceModel(model);
        setSelectedAvatar(null);
      }
    } else {
      setSavedReferenceModel(null);
    }

    if (asset.avatarId && !asset.modelId) {
      const avatar = AVATARS.find(a => a.id === asset.avatarId);
      if (avatar) setSelectedAvatar(avatar);
      setPreserveOriginal(false);
    } else if (!asset.modelId) {
      setPreserveOriginal(true);
    } else {
      setPreserveOriginal(false);
    }

    if (asset.settingId) {
      const setting = SETTINGS.find(s => s.id === asset.settingId);
      if (setting) setSelectedSetting(setting);
    }

    if (asset.cameraAngle) setSelectedAngle(asset.cameraAngle);
    if (asset.cameraFraming) setSelectedFraming(asset.cameraFraming);
    if (asset.modelPose) setSelectedPose(asset.modelPose);

    setSelectedRatio(asset.ratio);
    setCustomPrompt(asset.customPrompt);
  };

  // Toggle selection of an asset
  const toggleAssetSelection = (assetId: string) => {
    const newSet = new Set(selectedAssetIds);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setSelectedAssetIds(newSet);
  };

  // Handle asset click based on mode
  const handleAssetClick = (asset: GeneratedAsset) => {
    if (isSelectionMode) {
      if (asset.id) toggleAssetSelection(asset.id);
    } else {
      setActiveAsset(asset);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssetIds.size === 0) return;

    if (window.confirm(`Are you sure you want to delete ${selectedAssetIds.size} images? This cannot be undone.`)) {
      // 1. Optimistic Update
      const idsToDelete = Array.from(selectedAssetIds);
      setGeneratedAssets(prev => prev.filter(a => !selectedAssetIds.has(a.id)));

      // If active asset is deleted, clear it
      if (activeAsset && selectedAssetIds.has(activeAsset.id)) {
        setActiveAsset(null);
      }

      // 2. Clear selection mode
      setIsSelectionMode(false);
      setSelectedAssetIds(new Set());

      // 3. Perform Deletions
      try {
        // We need to find the full asset objects to get URLs for storage deletion
        const assetsToDelete = generatedAssets.filter(a => idsToDelete.includes(a.id));

        await Promise.all(assetsToDelete.map(asset =>
          assetStorage.deleteAsset(asset.id, asset.imageUrl)
        ));
      } catch (error) {
        console.error("Bulk delete failed:", error);
        alert("Some images may not have been deleted from the server. Please refresh.");
      }
    }
  };

  // Upscale State
  const [shouldUpscale, setShouldUpscale] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);

  const handleDownload = async (asset: GeneratedAsset) => {
    try {
      let downloadUrl = asset.imageUrl;
      let filename = `lumiere-${asset.id}.png`;

      // 1. Check Upscale
      if (shouldUpscale) {
        setIsUpscaling(true);
        try {
          // Upscale returns a data-URI (base64) from UpscalerJS
          downloadUrl = await upscaleImage(asset.imageUrl, "2x");
          filename = `lumiere-${asset.id}-upscaled.png`;
        } catch (error) {
          console.error("Upscale failed:", error);
          alert("Upscaling failed. Downloading original instead.");
          // Fallback to original URL
          downloadUrl = asset.imageUrl;
        } finally {
          setIsUpscaling(false);
        }
      }

      // 2. Force Download using Blob (Fixes "Opens in Tab" issue for external URLs)
      // We fetch the URL (whether it's the original HTTP Supabase URL or the base64 data-URI)
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up memory
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 100);

    } catch (error) {
      console.error("Download failed:", error);
      // Desperate backup: Just open it
      window.open(asset.imageUrl, '_blank');
    }
  };

  // Download image with text overlay baked in
  const handleDownloadWithOverlay = async (asset: GeneratedAsset) => {
    try {
      // 1. Load the image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = asset.imageUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load image"));
      });

      // 2. Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context not available");

      // 3. Draw image
      ctx.drawImage(img, 0, 0);

      // 4. Calculate text positions
      const padding = Math.round(img.width * 0.05);
      let textX = padding;
      let textY = padding + Math.round(img.height * 0.08);

      if (overlayPosition === 'center') {
        textX = img.width / 2;
        textY = img.height / 2;
        ctx.textAlign = 'center';
      } else if (overlayPosition === 'bottom-left') {
        textY = img.height - padding - Math.round(img.height * 0.1);
      }

      // 5. Draw product name (if provided) - ALL BOLD
      if (overlayProductName) {
        const fontSize = Math.round(img.width * 0.04);
        ctx.font = `700 ${fontSize}px "Inter", sans-serif`;
        ctx.fillStyle = overlayTextColor; // User-selected color
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;

        // Split into lines if there are multiple words
        const words = overlayProductName.split(' ');
        const midpoint = Math.ceil(words.length / 2);
        const line1 = words.slice(0, midpoint).join(' ');
        const line2 = words.slice(midpoint).join(' ');

        ctx.fillText(line1, textX, textY);
        ctx.fillText(line2, textX, textY + fontSize * 1.2);
        textY += fontSize * 2.8;
      }

      // 6. Draw prices (if provided)
      if (overlaySalePrice || overlayOriginalPrice) {
        const priceSize = Math.round(img.width * 0.035);
        ctx.shadowBlur = 3;

        if (overlayOriginalPrice && overlaySalePrice) {
          // BOTH prices → Original with RED strikethrough + Sale price bold
          ctx.font = `400 ${priceSize}px "Inter", sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          const originalText = `₹${overlayOriginalPrice}`;
          const originalWidth = ctx.measureText(originalText).width;
          ctx.fillText(originalText, textX, textY);

          // RED Strikethrough line
          ctx.beginPath();
          ctx.moveTo(textX, textY - priceSize * 0.3);
          ctx.lineTo(textX + originalWidth, textY - priceSize * 0.3);
          ctx.strokeStyle = '#ef4444'; // Red color
          ctx.lineWidth = 2;
          ctx.stroke();

          // Sale price - BOLD
          ctx.font = `700 ${priceSize * 1.2}px "Inter", sans-serif`;
          ctx.fillStyle = overlayTextColor; // User-selected color
          ctx.fillText(`₹${overlaySalePrice}`, textX + originalWidth + 15, textY);
        } else {
          // ONLY ONE price (no sale = no strikethrough) → Show as BOLD normal price
          const thePrice = overlaySalePrice || overlayOriginalPrice;
          ctx.font = `700 ${priceSize}px "Inter", sans-serif`;
          ctx.fillStyle = overlayTextColor; // User-selected color
          ctx.fillText(`₹${thePrice}`, textX, textY);
        }
      }

      // 7. Draw watermark (if provided) - VERTICAL on right edge
      if (overlayWatermark) {
        const wmSize = Math.round(img.width * 0.018);
        ctx.save(); // Save current state before rotation

        // Move to right side, vertically centered
        ctx.translate(img.width - padding / 2, img.height / 2);
        ctx.rotate(-Math.PI / 2); // Rotate 90° counter-clockwise (text reads bottom-to-top)

        ctx.font = `400 ${wmSize}px "Inter", sans-serif`;
        ctx.fillStyle = overlayTextColor; // Use selected color
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 2;
        ctx.fillText(overlayWatermark, 0, 0);

        ctx.restore(); // Restore to original state
      }

      // 8. Export (and optionally upscale) and download
      let finalDataUrl = canvas.toDataURL('image/png');
      let filename = `lumiere-${asset.id}-ad.png`;

      // Upscale if requested
      if (shouldUpscale) {
        setIsUpscaling(true);
        try {
          finalDataUrl = await upscaleImage(finalDataUrl, "2x");
          filename = `lumiere-${asset.id}-ad-upscaled.png`;
        } catch (err) {
          console.error("Upscale failed, using original:", err);
        } finally {
          setIsUpscaling(false);
        }
      }

      // Convert to blob and download
      const response = await fetch(finalDataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Overlay download failed:", error);
      alert("Failed to create ad image. Downloading original.");
      handleDownload(asset);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-brand-950 text-brand-100 font-sans overflow-hidden">
      <DebugConsole />
      <Header />

      {/* Main Layout Container */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        {/* 
           LEFT PANEL: CONFIGURATION 
           Responsive: Bottom on mobile, Left on desktop.
           Fixed width on desktop for sidebar stability.
        */}
        <aside className="
          order-2 md:order-1
          w-full md:w-96 lg:w-[420px] flex-shrink-0 
          h-[55%] md:h-full 
          bg-brand-950 border-t md:border-t-0 md:border-r border-brand-800 
          flex flex-col 
          z-20
        ">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6 md:space-y-8 pb-24">

            {/* 1. UPLOAD & PRESERVE */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-800 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  Input & Mode
                </h2>
                {uploadedImage && (
                  <button onClick={clearUpload} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>

              <div
                onClick={!uploadedImage ? triggerFileUpload : undefined}
                className={`
                  relative border-2 border-dashed rounded-xl transition-all duration-300 overflow-hidden group mb-3
                  ${uploadedImage ? 'border-brand-700 bg-brand-900 h-40' : 'border-brand-700 hover:border-brand-500 hover:bg-brand-900 cursor-pointer h-32 flex flex-col items-center justify-center'}
                `}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*"
                />

                {uploadedImage ? (
                  <div className="relative w-full h-full">
                    <img src={uploadedImage} alt="Upload" className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={triggerFileUpload} className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-full shadow-lg">
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Upload size={18} className="text-brand-300" />
                    </div>
                    <p className="text-xs font-medium text-brand-200">Upload Image</p>
                  </>
                )}
              </div>

              <label
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none
                  ${preserveOriginal
                    ? 'bg-yellow-900/20 border-yellow-600/50 shadow-sm'
                    : 'bg-brand-900 border-brand-800 hover:border-brand-700'
                  }
                `}
              >
                <div
                  className={`
                     w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0
                     ${preserveOriginal ? 'bg-yellow-500 border-yellow-500' : 'border-brand-600 bg-transparent'}
                   `}
                  onClick={(e) => {
                    e.preventDefault();
                    setPreserveOriginal(!preserveOriginal);
                  }}
                >
                  {preserveOriginal && <Check size={14} className="text-black" strokeWidth={3} />}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${preserveOriginal ? 'text-yellow-400' : 'text-brand-200'}`}>
                    Keep Original Look
                  </span>
                  <span className="text-[10px] text-brand-500 leading-tight">
                    Disable model/setting changes. Only adjust camera.
                  </span>
                </div>
              </label>

              {/* High Fidelity Mode Toggle */}
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 mt-2 ${highFidelityMode
                  ? 'bg-indigo-500/10 border-indigo-500/30'
                  : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${highFidelityMode ? 'bg-indigo-500 border-indigo-500' : 'border-white/30'
                    }`}
                  onClick={(e) => {
                    e.preventDefault();
                    setHighFidelityMode(!highFidelityMode);
                  }}
                >
                  {highFidelityMode && <Check size={14} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${highFidelityMode ? 'text-indigo-400' : 'text-brand-200'}`}>
                    Commercial Style
                  </span>
                  <span className="text-[10px] text-brand-500 leading-tight">
                    Clean digital look. No vintage film styling.
                  </span>
                </div>
              </label>

            </section>

            {/* 2. CAMERA & POSE (Always Visible) */}
            <section>
              <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-brand-800 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                Camera & Pose
              </h2>
              <div className="grid grid-cols-1 gap-4 bg-brand-900 p-4 rounded-xl border border-brand-800 shadow-inner">

                {/* Product Type */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-brand-400 uppercase flex items-center gap-1.5">
                    <Type size={10} /> Product Type
                  </label>
                  <div className="flex bg-brand-950 p-1 rounded-lg border border-brand-800 flex-wrap gap-1">
                    {PRODUCT_TYPES.map(pt => (
                      <button
                        key={pt.id}
                        onClick={() => setSelectedProductType(pt.id)}
                        className={`flex-1 min-w-[70px] py-1.5 text-[10px] font-medium rounded-md transition-all ${selectedProductType === pt.id ? 'bg-brand-700 text-white shadow-sm' : 'text-brand-500 hover:text-brand-300 hover:bg-brand-900'}`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Angle */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-brand-400 uppercase flex items-center gap-1.5">
                    <Camera size={10} /> Camera Angle
                  </label>
                  <div className="flex bg-brand-950 p-1 rounded-lg border border-brand-800 flex-wrap gap-1">
                    {CAMERA_ANGLES.map(angle => (
                      <button
                        key={angle.id}
                        onClick={() => setSelectedAngle(angle.id)}
                        className={`flex-1 min-w-[80px] py-1.5 text-[10px] font-medium rounded-md transition-all ${selectedAngle === angle.id ? 'bg-brand-700 text-white shadow-sm' : 'text-brand-500 hover:text-brand-300 hover:bg-brand-900'}`}
                      >
                        {angle.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Framing */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-brand-400 uppercase flex items-center gap-1.5">
                    <Focus size={10} /> Framing
                  </label>
                  <div className="flex bg-brand-950 p-1 rounded-lg border border-brand-800">
                    {CAMERA_FRAMINGS.map(framing => (
                      <button
                        key={framing.id}
                        onClick={() => setSelectedFraming(framing.id)}
                        className={`flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all ${selectedFraming === framing.id ? 'bg-brand-700 text-white shadow-sm' : 'text-brand-500 hover:text-brand-300 hover:bg-brand-900'}`}
                      >
                        {framing.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pose */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-brand-400 uppercase flex items-center gap-1.5">
                    <User size={10} /> Model Pose
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MODEL_POSES.map(pose => (
                      <button
                        key={pose.id}
                        onClick={() => setSelectedPose(pose.id)}
                        className={`px-3 py-1.5 text-[10px] font-medium rounded-md border transition-all flex-1 text-center
                            ${selectedPose === pose.id
                            ? 'bg-brand-700 border-brand-600 text-white shadow-sm'
                            : 'bg-brand-950 border-brand-800 text-brand-500 hover:border-brand-600 hover:text-brand-300'
                          }
                          `}
                      >
                        {pose.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </section>

            {/* 3. MODEL SELECTION */}
            <section className={`transition-all duration-300 ${preserveOriginal ? 'opacity-40 grayscale pointer-events-none select-none' : 'opacity-100'}`}>
              <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-brand-800 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                Select Model
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      setSelectedAvatar(avatar);
                      setSavedReferenceModel(null); // Clear saved model if preset is selected
                    }}
                    className={`
                      relative rounded-lg overflow-hidden aspect-[3/4] border transition-all text-left group bg-brand-800
                      ${selectedAvatar?.id === avatar.id ? 'border-white ring-1 ring-white/50 shadow-lg z-10' : 'border-brand-800 hover:border-brand-500'}
                    `}
                  >
                    <div className="absolute inset-0 bg-brand-800" />
                    <img
                      src={avatar.imageUrl}
                      alt={avatar.name}
                      className="w-full h-full object-cover relative z-10 opacity-90 group-hover:opacity-100 transition-opacity"
                    />

                    {/* Improved Label Readability */}
                    <div className="absolute inset-x-0 bottom-0 p-1 z-20">
                      <div className="bg-black/70 backdrop-blur-[2px] rounded px-1.5 py-1">
                        <p className="text-[8px] font-semibold text-white leading-none text-center">{avatar.name}</p>
                      </div>
                    </div>

                    {selectedAvatar?.id === avatar.id && (
                      <div className="absolute top-1 right-1 bg-brand-500 text-white rounded-full p-0.5 shadow-sm z-30">
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Saved Model Library Integration */}
              <div className="mt-6 pt-6 border-t border-brand-800">
                <ModelLibrary
                  onSelectModel={handleSelectSavedModel}
                  selectedModelId={savedReferenceModel?.id}
                  onSaveCurrentModel={handleSaveAsModel}
                  currentImage={activeAsset?.imageUrl}
                />
              </div>
            </section>

            {/* 4. ENVIRONMENT */}
            <section className={`transition-all duration-300 ${preserveOriginal ? 'opacity-40 grayscale pointer-events-none select-none' : 'opacity-100'}`}>
              <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-brand-800 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                Environment
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {SETTINGS.map((setting) => (
                  <button
                    key={setting.id}
                    onClick={() => setSelectedSetting(setting)}
                    className={`
                      relative rounded-lg overflow-hidden h-20 border transition-all text-left group bg-brand-800
                      ${selectedSetting?.id === setting.id ? 'border-white ring-1 ring-white/50 z-10' : 'border-brand-800 hover:border-brand-500'}
                    `}
                  >
                    <div className="absolute inset-0 bg-brand-800" />
                    <img src={setting.imageUrl} alt={setting.name} className="w-full h-full object-cover relative z-10 opacity-90 group-hover:opacity-100" />

                    {/* Improved Label Readability */}
                    <div className="absolute inset-0 flex items-center justify-center z-20 p-2">
                      <div className="bg-black/60 backdrop-blur-[2px] rounded px-2 py-1">
                        <span className="text-[9px] font-bold text-white text-center block">{setting.name}</span>
                      </div>
                    </div>

                    {selectedSetting?.id === setting.id && (
                      <div className="absolute top-1 right-1 bg-brand-500 text-white rounded-full p-0.5 shadow-sm z-30">
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* 5. FORMAT */}
            <section>
              <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-brand-800 text-white flex items-center justify-center text-[10px] font-bold">5</span>
                Format & Details
              </h2>

              <div className="flex flex-wrap gap-2 mb-3">
                {(Object.values(AspectRatio) as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`
                      px-2.5 py-1.5 rounded-md text-[10px] font-medium border transition-colors
                      ${selectedRatio === ratio
                        ? 'bg-white text-brand-950 border-white shadow-sm'
                        : 'bg-transparent text-brand-400 border-brand-800 hover:border-brand-600 hover:text-brand-200'}
                    `}
                  >
                    {RATIO_LABELS[ratio]}
                  </button>
                ))}
              </div>

              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Add custom instructions (e.g. 'soft morning light', 'red lipstick')..."
                className="w-full bg-brand-900 border border-brand-800 rounded-lg p-3 text-xs text-white placeholder-brand-500 focus:outline-none focus:border-brand-500 resize-none h-16"
              />
            </section>

          </div>

          {/* CTA */}
          <div className="p-4 bg-brand-950/95 backdrop-blur-sm border-t border-brand-800 sticky bottom-0 z-30 space-y-3">
            {/* Image Count Selector */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Images to Generate</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => setGenerateCount(num)}
                    className={`px-3 py-1 text-xs rounded font-medium transition-all ${generateCount === num
                      ? 'bg-white text-brand-950'
                      : 'bg-brand-800 text-brand-300 hover:bg-brand-700'
                      }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleGenerate()}
              disabled={status === 'generating' || !uploadedImage}
              className={`
                  w-full py-3 rounded-full font-serif font-semibold text-base flex items-center justify-center gap-2 transition-all
                  ${status === 'generating'
                  ? 'bg-brand-800 text-brand-400 cursor-not-allowed'
                  : !uploadedImage
                    ? 'bg-brand-800 text-brand-500 cursor-not-allowed'
                    : 'bg-white text-brand-950 hover:bg-gray-200 hover:scale-[1.02] active:scale-95 shadow-lg'
                }
                `}
            >
              {status === 'generating' ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Processing...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Generate Assets
                </>
              )}
            </button>
          </div>
        </aside>

        {/* 
           RIGHT PANEL: PREVIEW & GALLERY 
           Responsive: Top on mobile, Right on desktop.
        */}
        <div className="
          order-1 md:order-2
          flex-1 flex flex-col min-w-0 
          bg-brand-900 relative 
          h-[45%] md:h-full
          z-10
        ">

          {/* Main Workspace - SCROLLABLE */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 flex flex-col items-center w-full custom-scrollbar pb-20 md:pb-8">
            {activeAsset ? (
              <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in duration-500">

                {/* Main Image Card - No height restriction, scrollable parent */}
                <div className="relative group rounded-xl overflow-hidden shadow-2xl shadow-black bg-brand-950 border border-brand-800 self-center max-w-full transition-all duration-500">
                  <img
                    src={activeAsset.imageUrl}
                    alt="Result"
                    className="max-h-[50vh] md:max-h-[70vh] max-w-full object-contain"
                  />

                  {/* Overlay Actions */}
                  <div className="absolute top-2 right-2 md:top-4 md:right-4">
                    <button
                      onClick={() => toggleShortlist(activeAsset.id)}
                      className={`
                          p-2 md:p-3 rounded-full shadow-lg backdrop-blur-md transition-all flex items-center justify-center hover:scale-110 active:scale-95
                          ${activeAsset.isShortlisted ? 'bg-brand-500 text-white' : 'bg-white/90 text-brand-950'}
                        `}
                    >
                      <Heart size={18} fill={activeAsset.isShortlisted ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>

                {/* 1. Top Action Bar: Download & Remix (Desktop) */}
                <div className="hidden md:flex bg-brand-950 border border-brand-800 rounded-xl p-3 items-center justify-between gap-3 w-full shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(activeAsset)}
                        disabled={isUpscaling}
                        className="px-4 py-2 bg-white text-brand-950 rounded-lg hover:bg-gray-200 font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-wait"
                      >
                        {isUpscaling ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {isUpscaling ? 'Upscaling...' : 'Download'}
                      </button>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none px-2">
                        <input
                          type="checkbox"
                          checked={shouldUpscale}
                          onChange={(e) => setShouldUpscale(e.target.checked)}
                          className="rounded border-gray-600 bg-brand-900 text-brand-500 focus:ring-brand-500 w-3 h-3"
                        />
                        <span className="text-[10px] text-brand-300 font-medium whitespace-nowrap">Upscale (2x)</span>
                      </label>
                    </div>
                    <button
                      onClick={() => handleRemix(activeAsset)}
                      className="px-4 py-2 bg-brand-800 text-white rounded-lg hover:bg-brand-700 font-medium text-xs flex items-center gap-2 transition-colors"
                    >
                      <Edit3 size={14} /> Remix
                    </button>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto">
                    <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mr-1 flex-shrink-0">Variations:</span>
                    {(Object.values(AspectRatio) as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => handleVariation(ratio)}
                        disabled={status === 'generating'}
                        className="px-2.5 py-1.5 bg-brand-900 border border-brand-700 hover:border-brand-500 text-brand-300 hover:text-white text-[10px] rounded transition-all flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {status === 'generating' && activeAsset.ratio !== ratio ? <Loader2 size={10} className="animate-spin" /> : <Maximize2 size={10} />}
                        {RATIO_LABELS[ratio].split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Refine Shot Toolbar (Desktop/Mobile Unified) */}
                <div className="bg-brand-800/50 border border-brand-700 rounded-xl p-3 w-full shadow-inner backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw size={12} className="text-brand-400" />
                    <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">Refine Shot</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {/* Angle Select */}
                    <select
                      value={refineAngle}
                      onChange={(e) => setRefineAngle(e.target.value as CameraAngle)}
                      className="bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                    >
                      {CAMERA_ANGLES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>

                    {/* Framing Select */}
                    <select
                      value={refineFraming}
                      onChange={(e) => setRefineFraming(e.target.value as CameraFraming)}
                      className="bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                    >
                      {CAMERA_FRAMINGS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>

                    {/* Pose Select */}
                    <select
                      value={refinePose}
                      onChange={(e) => setRefinePose(e.target.value as ModelPose)}
                      className="bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                    >
                      {MODEL_POSES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>

                    {/* Apply Button */}
                    <button
                      onClick={handleRefine}
                      disabled={status === 'generating'}
                      className="bg-brand-200 hover:bg-white text-brand-950 text-xs font-bold rounded px-3 py-1.5 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {status === 'generating' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Apply Changes
                    </button>
                  </div>
                </div>

                {/* 3. Ad Creative Panel */}
                <div className="bg-brand-800/50 border border-brand-700 rounded-xl p-3 w-full shadow-inner backdrop-blur-sm">
                  <button
                    onClick={() => setShowOverlayPanel(!showOverlayPanel)}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <Type size={12} className="text-brand-400" />
                      <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">Ad Creative</span>
                    </div>
                    <ChevronDown size={14} className={`text-brand-400 transition-transform ${showOverlayPanel ? 'rotate-180' : ''}`} />
                  </button>

                  {showOverlayPanel && (
                    <div className="mt-3 space-y-3">
                      {/* Product Name */}
                      <div>
                        <label className="text-[10px] text-brand-400 block mb-1">Product Name</label>
                        <input
                          type="text"
                          value={overlayProductName}
                          onChange={(e) => setOverlayProductName(e.target.value)}
                          placeholder="TWO TONE BOX HANDBAG"
                          className="w-full bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-brand-500"
                        />
                      </div>

                      {/* Prices Row */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-brand-400 block mb-1">Original Price</label>
                          <input
                            type="text"
                            value={overlayOriginalPrice}
                            onChange={(e) => setOverlayOriginalPrice(e.target.value)}
                            placeholder="4,750"
                            className="w-full bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-brand-400 block mb-1">Sale Price</label>
                          <input
                            type="text"
                            value={overlaySalePrice}
                            onChange={(e) => setOverlaySalePrice(e.target.value)}
                            placeholder="1,550"
                            className="w-full bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Position & Watermark Row */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-brand-400 block mb-1">Position</label>
                          <select
                            value={overlayPosition}
                            onChange={(e) => setOverlayPosition(e.target.value as 'top-left' | 'center' | 'bottom-left')}
                            className="w-full bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                          >
                            <option value="top-left">Top Left</option>
                            <option value="center">Center</option>
                            <option value="bottom-left">Bottom Left</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-brand-400 block mb-1">Watermark</label>
                          <input
                            type="text"
                            value={overlayWatermark}
                            onChange={(e) => setOverlayWatermark(e.target.value)}
                            placeholder="yourbrand.com"
                            className="w-full bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Text Color Picker */}
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] text-brand-400 whitespace-nowrap">Text Color</label>
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="color"
                            value={overlayTextColor}
                            onChange={(e) => setOverlayTextColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border border-brand-600 bg-transparent"
                          />
                          <div className="flex gap-1">
                            {['#ffffff', '#000000', '#f5f5dc', '#1a1a2e'].map((color) => (
                              <button
                                key={color}
                                onClick={() => setOverlayTextColor(color)}
                                className={`w-6 h-6 rounded border-2 ${overlayTextColor === color ? 'border-brand-500' : 'border-brand-700'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Upscale + Download Row */}
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={shouldUpscale}
                            onChange={(e) => setShouldUpscale(e.target.checked)}
                            className="rounded border-gray-600 bg-brand-900 text-brand-500 focus:ring-brand-500 w-3 h-3"
                          />
                          <span className="text-[10px] text-brand-300 font-medium whitespace-nowrap">Upscale (2x)</span>
                        </label>
                        <button
                          onClick={() => handleDownloadWithOverlay(activeAsset)}
                          disabled={isUpscaling}
                          className="flex-1 bg-gradient-to-r from-brand-500 to-purple-500 text-white text-xs font-bold rounded px-3 py-2 flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-70"
                        >
                          {isUpscaling ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                          {isUpscaling ? 'Processing...' : 'Download Ad Creative'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Action Bar (Fallback) */}
                <div className="md:hidden flex justify-between gap-2 overflow-x-auto pb-2">
                  <a
                    href={activeAsset.imageUrl}
                    download={`lumiere-${activeAsset.id}.png`}
                    className="px-3 py-2 bg-white text-brand-950 rounded-lg shadow-lg text-[10px] font-bold flex items-center gap-1 whitespace-nowrap"
                  >
                    <Download size={10} /> Save
                  </a>
                  <div className="flex gap-1">
                    {(Object.values(AspectRatio) as AspectRatio[]).slice(0, 3).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => handleVariation(ratio)}
                        className="px-2 py-1 bg-brand-800 text-brand-300 rounded border border-brand-700 text-[10px]"
                      >
                        {RATIO_LABELS[ratio].split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-brand-600 opacity-60 select-none p-6 text-center">
                <div className="w-16 h-16 md:w-24 md:h-24 border-2 border-dashed border-brand-700 rounded-2xl flex items-center justify-center mb-4 bg-brand-950/50">
                  <ImageIcon size={32} className="md:w-10 md:h-10 text-brand-700" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-lg md:text-2xl mb-2 text-brand-500">Lumière AI</h3>
                <p className="text-xs md:text-sm text-brand-600 max-w-[240px]">Upload a product to start your virtual photoshoot.</p>
              </div>
            )}
          </div>

          {/* Bottom Gallery Strip */}
          <div className="h-28 md:h-36 bg-brand-950 border-t border-brand-800 flex flex-col shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between border-b border-brand-800 px-2 bg-brand-950">

              {/* Left: TABS */}
              <div className="flex items-center">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'all' ? 'border-brand-400 text-white' : 'border-transparent text-brand-500 hover:text-brand-300'}`}
                >
                  <History size={12} /> Session ({generatedAssets.length})
                </button>
                <button
                  onClick={() => setActiveTab('shortlist')}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'shortlist' ? 'border-brand-400 text-white' : 'border-transparent text-brand-500 hover:text-brand-300'}`}
                >
                  <Heart size={12} /> Shortlist ({generatedAssets.filter(a => a.isShortlisted).length})
                </button>
              </div>

              {/* Right: ACTIONS (Select Mode) */}
              <div className="flex items-center gap-2 pr-2">
                {!isSelectionMode ? (
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-400 hover:text-white border border-brand-800 hover:border-brand-600 rounded flex items-center gap-1 transition-all"
                  >
                    Select
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedAssetIds(new Set());
                      }}
                      className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-500 hover:text-brand-300 transition-colors"
                    >
                      Cancel
                    </button>
                    {selectedAssetIds.size > 0 && (
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white rounded flex items-center gap-1 transition-all"
                      >
                        <Trash2 size={10} /> Delete ({selectedAssetIds.size})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-x-auto p-3 flex gap-3 items-center custom-scrollbar bg-brand-900/30">
              {displayedAssets.length === 0 ? (
                <div className="w-full flex items-center justify-center text-brand-700">
                  <span className="text-[10px] italic tracking-wide">Empty gallery</span>
                </div>
              ) : (
                displayedAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onSelect={handleAssetClick}
                    isActive={activeAsset?.id === asset.id}
                    selectionMode={isSelectionMode}
                    isSelected={selectedAssetIds.has(asset.id)}
                  />
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
