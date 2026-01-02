
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
  SETTINGS,
  RATIO_LABELS,
  CAMERA_ANGLES,
  CAMERA_FRAMINGS,
  MODEL_POSES,
  PRODUCT_TYPES,
  BODY_TYPES,
  AGE_RANGES,
  ETHNICITIES,
  HAIR_STYLES,
  MODEL_EXPRESSIONS,
  MODEL_REALISM_SUFFIX
} from './constants';
import {
  GeneratedAsset,
  SettingPreset,
  AspectRatio,
  GenerationStatus,
  CameraAngle,
  CameraFraming,
  ModelPose,
  ProductType,
  BodyType,
  AgeRange,
  Ethnicity,
  HairStyle,
  ModelExpression
} from './types';
import { generateFashionAssets } from './services/geminiService';
import { upscaleImage } from './services/upscaleService';

// Type for reference model (saved model used for consistency)
type ReferenceModel = SavedModel | null;

// CONSTANT PROMPTS
const PRODUCT_INTEGRITY_PROMPT = `
PRODUCT INTEGRITY (NON-NEGOTIABLE):
The product from the reference image (garment, accessory, shoes, jewelry, bags, hats) must be reproduced with EXACT fidelity:
- EXACT DETAILS: Buttons, zippers, hardware, pockets, stitching, logos, labels.
- EXACT MATERIAL: Silk looks like silk, leather looks like leather, denim looks like denim.
- EXACT COLOR: Match the precise hex values, hue, saturation, and brightness. No color shifting.
- EXACT TEXTURE: Preserve fabric weave, leather grain, surface detail, sheen, and material properties.
- EXACT STRUCTURE: Maintain the garment's construction, seams, stitching, and hardware.

CRITICAL-FIT & SILHOUETTE (ABSOLUTE PRIORITY):
- The fit/cut from the reference image is IMMUTABLE. It must not change.
- UNIVERSAL CONSISTENCY: Regardless of the new setting, pose, or lighting, the garment's shape must remain identical.
- If it is loose/oversized, it MUST look loose/oversized.
- If it is tapered/structural, it MUST look tapered/structural.

NATURAL INTEGRATION:
- The garment must sit naturally on the model's body (respect gravity and physics). 
- It must NOT look "abnormal" or "pasted on". It must fit the model realistically while maintaining its original cut.

This is the single most important requirement. The product IS what is being photographed.
`.trim();

const App: React.FC = () => {
  // Core Configuration State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // New State: Preserve Mode
  const [preserveOriginal, setPreserveOriginal] = useState<boolean>(false);


  // Camera & Pose Controls (Left Sidebar-Global)
  const [selectedAngle, setSelectedAngle] = useState<CameraAngle>('eye-level');
  const [selectedFraming, setSelectedFraming] = useState<CameraFraming>('wide');
  const [selectedPose, setSelectedPose] = useState<ModelPose>('generic');
  const [selectedProductType, setSelectedProductType] = useState<ProductType>('top');

  // Refine Controls (Right Panel-Local)
  const [refineAngle, setRefineAngle] = useState<CameraAngle>('eye-level');
  const [refineFraming, setRefineFraming] = useState<CameraFraming>('medium');
  const [refinePose, setRefinePose] = useState<ModelPose>('standing');

  // Model Builder State (replaces selectedAvatar)
  const [selectedBodyType, setSelectedBodyType] = useState<BodyType>('slim');
  const [selectedAge, setSelectedAge] = useState<AgeRange>('30s');
  const [selectedEthnicity, setSelectedEthnicity] = useState<Ethnicity>('south-asian');
  const [selectedHair, setSelectedHair] = useState<HairStyle>('long-wavy');
  const [selectedExpression, setSelectedExpression] = useState<ModelExpression>('editorial');

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
  const [overlaySubheader, setOverlaySubheader] = useState(''); // New subheader state
  const [overlayOriginalPrice, setOverlayOriginalPrice] = useState('');
  const [overlaySalePrice, setOverlaySalePrice] = useState('');
  const [overlayWatermark, setOverlayWatermark] = useState('');
  const [overlayPosition, setOverlayPosition] = useState<'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'>('bottom-left');
  const [overlayTextColor, setOverlayTextColor] = useState('#ffffff');
  const [overlayWatermarkColor, setOverlayWatermarkColor] = useState('#ffffff');
  const [overlayFontSize, setOverlayFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [overlayFontFamily, setOverlayFontFamily] = useState<'Inter' | 'Playfair Display' | 'Roboto' | 'Montserrat' | 'Lato' | 'Oswald' | 'Merriweather' | 'Raleway'>('Inter');
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);

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
  };

  // Helper to translate UI options into powerful prompt instructions
  const getDetailedAngleDescription = (angle: CameraAngle): string => {
    switch (angle) {
      case 'eye-level': return "EYE LEVEL, camera positioned at the subject's eye height, looking STRAIGHT at them. No tilt.";
      case 'low-angle': return "LOW ANGLE, camera positioned BENEATH the subject's eye level, looking UP at them.";
      case 'high-angle': return "HIGH ANGLE, camera positioned ABOVE the subject, tilted DOWN looking at them.";
      case 'side-angle': return "SIDE PROFILE, 90-degree lateral view of the subject, profile silhouette";
      default: return "EYE LEVEL, camera at subject's eye height, horizontally straight";
    }
  };

  // Build dynamic model description from selections
  const buildModelDescription = (): string => {
    const bodyPrompt = BODY_TYPES.find(b => b.id === selectedBodyType)?.prompt || '';
    const agePrompt = AGE_RANGES.find(a => a.id === selectedAge)?.prompt || '';
    const ethnicityPrompt = ETHNICITIES.find(e => e.id === selectedEthnicity)?.prompt || '';
    const hairPrompt = HAIR_STYLES.find(h => h.id === selectedHair)?.prompt || '';
    const expressionPrompt = MODEL_EXPRESSIONS.find(e => e.id === selectedExpression)?.prompt || '';

    return `A ${bodyPrompt} ${ethnicityPrompt}, ${agePrompt}, with ${hairPrompt}, ${expressionPrompt}. ${MODEL_REALISM_SUFFIX}`;
  };

  // Original Generation Logic
  const handleGenerate = async (overrideRatio?: AspectRatio) => {
    if (!uploadedImage) {
      alert("Please upload a product image first.");
      return;
    }

    // Validate selections if not in preserve mode
    if (!preserveOriginal && !selectedSetting) {
      alert("Please select an Environment.");
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
          'wide': 'FULL BODY shot from head to toe, showing the accessory within the complete outfit context',
          'medium': 'product-focused shot with the accessory as the clear focal point',
          'close-up': 'detailed product shot highlighting the accessory texture, material, and craftsmanship'
        }
      };
      return framingMatrix[productType][framing] || 'medium fashion shot';
    };

    const framingLabel = getSmartFramingDescription(selectedFraming, selectedProductType);
    const poseLabel = MODEL_POSES.find(p => p.id === selectedPose)?.label || 'Standing';

    // Product priority instruction-ensures the product isn't cropped out
    const productPriorityNote = 'IMPORTANT: The PRODUCT/GARMENT from the reference image must ALWAYS be fully visible. Adjust framing as needed to ensure the entire garment is shown.';

    // PRODUCT INTEGRITY-NON-NEGOTIABLE (applies to ALL generation types)
    const productIntegrityNote = PRODUCT_INTEGRITY_PROMPT;

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



      // PHOTOREALISM-Anti-AI artifacts (used in ALL prompts)
      const photoRealismNote = `
        ⚠️ PHOTOREALISM (CRITICAL-THE MODEL MUST LOOK REAL, NOT AI-GENERATED):
        
        SKIN TEXTURE (MOST IMPORTANT):
        - Visible skin pores, especially on nose, forehead, and cheeks
        - Natural fine lines and subtle wrinkles appropriate to age
        - Subsurface scattering (skin translucency, light passing through ears)
        - Natural skin shine/oiliness, not matte plastic
        - Subtle imperfections: freckles, moles, slight redness
        - NO smooth AI-generated skin. NO airbrushed perfection. NO plastic look.
        - SKIN FINISH: Natural skin texture with visible pores. NOT GLOSSY, NOT OILY. Natural satin finish.
        
        HAIR:
        - Individual hair strands visible, natural flyaways and baby hairs
        - Realistic hair texture and shine, proper light reflections
        - NO smooth blob-like CGI hair
        
        EYES:
        - Natural catchlights reflecting light sources
        - Realistic iris detail with natural color variation
        - Visible blood vessels in whites of eyes
        - NO glassy/dead AI eyes
        
        BODY & PROPORTIONS:
        - Realistic healthy proportions, no elongated limbs
        - Natural arm/leg thickness with muscle definition
        - Correct number of fingers (5 per hand), proper joint placement
        - NO distorted hands, NO extra/missing fingers
        
        LIGHTING:
        - Natural light falloff and shadows
        - Proper color temperature matching environment
        - Realistic rim lighting if present
        - NO flat CG lighting
        
        OVERALL: The image must look like it was captured by a professional photographer with a DSLR camera, NOT generated by AI.
      `.trim();

      // STUDIO RUNOUT PREVENTION-Applies when Studio Grey or Clean Studio is selected
      const isStudioSetting = selectedSetting?.id === 'studio-grey' || selectedSetting?.id === 'clean-studio';
      const studioRunoutNote = isStudioSetting ? `
        STUDIO BACKDROP REQUIREMENT (ABSOLUTELY CRITICAL):
        The studio backdrop must be an INFINITE, UNBROKEN FIELD of color.
        1. NO VISIBLE CORNERS or studio architecture (walls, floors meeting walls).
        2. NO VISIBLE EQUIPMENT: Softboxes, stands, cables, and reflectors MUST NOT be visible. MASK THEM OUT.
        3. NO ROLLED PAPER EDGES or "runout".
        4. The entire background from edge-to-edge must be a pure, seamless, infinite ${selectedSetting?.id === 'studio-grey' ? 'grey' : 'white'} cyclorama.
        5. IGNORE REFERENCE IMAGE DEFECTS: Even if the input/reference image shows runout, studio lights, or edges, YOU MUST FIX IT. Do not replicate the background flaws.
        The image must look like it was cropped from the center of a massive studio with no edges visible.
      `.trim() : '';

      // ENVIRONMENT LIGHTING INTEGRATION-For exterior/location settings
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
          ⚠️ CAMERA ANGLE (CRITICAL-MUST BE RESPECTED):
          ${detailedAngle}
          - If LOW ANGLE is specified, the camera MUST be positioned BELOW the subject, shooting UPWARD.
          - If HIGH ANGLE is specified, the camera MUST be positioned ABOVE the subject, shooting DOWNWARD.
          - If EYE LEVEL is specified, the camera MUST be at the subject's eye height, shooting STRAIGHT.
          
          ⚠️ FRAMING/CROP (CRITICAL-MUST BE RESPECTED):
          ${framingLabel}
          - If WIDE is selected, the output MUST show FULL BODY from head to feet.
          - If MEDIUM is selected, the output MUST show approximately waist-up or three-quarter body.
          - If CLOSE-UP is selected, the output MUST show only upper body/chest area.
          
          SUBJECT POSE: The model should be ${poseLabel}.
          
          TASK: Editorial fashion photography. Retain the EXACT subject, clothing, and background from the input image.
          
          CRITICAL: Do NOT change the model's identity or the environment. Only adjust the camera perspective and framing as requested above.
          
          ${productIntegrityNote}
          
          ${productPriorityNote}
          
          CRITICAL OUTPUT REQUIREMENT: Generate a BORDERLESS, FULL-BLEED image with NO FRAMES. The photograph must fill the entire canvas edge-to-edge. NO film borders, NO film strips, NO sprocket holes, NO Kodak/Portra film frames, NO date stamps, NO margins of any color.
           STYLE INSPIRATION ONLY (do NOT add film frames): Natural light aesthetic inspired by 35mm film photography. Authentic skin texture, candid movement, subtle grain.
          
          ${photoRealismNote}
          
          ${studioRunoutNote}
          ${environmentLightingNote}
          
          ${customPrompt ? `ADDITIONAL INSTRUCTIONS: ${customPrompt}` : ''}
        `.trim();
      } else {
        // Mode: New Generation (Replace Model/Env)
        const shouldUseConsistency = !!(savedReferenceModel && modelBase64);

        fullPrompt = `
           🚫 ABSOLUTE RULE-NO BORDERS OF ANY KIND:
           This image MUST be 100% BORDERLESS and FULL-BLEED.
           - NO film borders, NO Kodak borders, NO Portra borders
           - NO sprocket holes, NO film strip edges
           - NO white margins, NO black margins, NO colored borders
           - NO date stamps, NO film frame overlays
           - The photograph must fill the ENTIRE canvas edge-to-edge with the actual scene.
           If you add ANY border or frame, THE ENTIRE IMAGE IS REJECTED.
           
           ⚠️ CAMERA ANGLE (CRITICAL-MUST BE RESPECTED):
           ${detailedAngle}
           - If LOW ANGLE is specified, the camera MUST be positioned BELOW the subject, shooting UPWARD.
           - If HIGH ANGLE is specified, the camera MUST be positioned ABOVE the subject, shooting DOWNWARD.
           - If EYE LEVEL is specified, the camera MUST be at the subject's eye height, shooting STRAIGHT.
           - This is NOT optional. The angle MUST be visually obvious in the output.
           
           ⚠️ FRAMING/CROP (CRITICAL-MUST BE RESPECTED):
           ${framingLabel}
           - If WIDE is selected, the output MUST show FULL BODY from head to feet.
           - If MEDIUM is selected, the output MUST show approximately waist-up or three-quarter body.
           - If CLOSE-UP is selected, the output MUST show only upper body/chest area.
           - The framing MUST match the instruction. Do NOT default to full body if medium/close-up was requested.
           
           TASK: Editorial fashion photography.
           Generate a raw, authentic photo of ${shouldUseConsistency ? 'the SPECIFIED MODEL' : 'the TARGET MODEL'} wearing the garment shown in the reference image.
           
           ${shouldUseConsistency
            ? `⚠️ CHARACTER CONSISTENCY (IDENTITY EXTRACTION ONLY):
               FROM THE MODEL REFERENCE, EXTRACT ONLY THESE 3 THINGS:
               ✅ Face (shape, features, skin tone, expression type)
               ✅ Hair (color, general style/texture)
               ✅ Body (height, build, proportions)
               
               ⛔ COMPLETELY IGNORE EVERYTHING ELSE FROM THE MODEL REFERENCE:
               ❌ Pose → CREATE NEW: ${poseLabel}
               ❌ Background/walls/floor → CREATE NEW: ${selectedSetting?.name || 'specified environment'}
               ❌ Clothing → USE ONLY: Product from INPUT IMAGE
               ❌ Camera angle → CREATE NEW: ${detailedAngle}
               ❌ Framing/crop → CREATE NEW: ${framingLabel}
               ❌ Lighting setup (softboxes, windows, rim lights) → CREATE NEW: Lighting for ${selectedSetting?.name}
               ❌ Shadows and reflections → CREATE NEW for the new environment
               ❌ Props and furniture → CREATE NEW or none
               
               🚨 ENVIRONMENT CONTAMINATION WARNING:
               The model reference may show studio lights, windows, or specific lighting.
               DO NOT copy these into the output.
               The output environment should be "${selectedSetting?.name}" - a completely different space.
               
               🚨 THIS IS A NEW PHOTOSHOOT, NOT AN EDIT:
               Imagine you hired this model for a NEW shoot in "${selectedSetting?.name}".
               The model walks in, the photographer sets up NEW lighting, the model takes a NEW pose.
               The reference photo does not exist in this new shoot.
               
               POSE DEFINITIONS:
               - STANDING: Model on feet, upright posture, weight even
               - WALKING: Mid-stride, one foot forward, dynamic
               - SITTING: Seated on floor/stool/chair
               - LEANING: Against wall or column
               - GENERIC: Any natural pose
               
               ⚠️ FINAL VERIFICATION (ALL MUST BE YES):
               1. Is the model doing "${poseLabel}"? (Not copied from reference)
               2. Is camera at "${selectedAngle}" angle? (Not copied)
               3. Is framing "${selectedFraming}"? (Not copied)
               4. Is garment from INPUT image? (Not from model reference)
               5. Is background "${selectedSetting?.name}"? (Not from model reference)
               6. Is lighting appropriate for "${selectedSetting?.name}"? (NO windows/lights from model reference)
               If ANY answer is NO, regenerate.`
            : `TARGET MODEL: ${buildModelDescription()}`
          }
           
           POSE: ${poseLabel}.
           ${productIntegrityNote}
           ${productPriorityNote}
           
           SETTING: ${selectedSetting?.description}.
           
           CRITICAL OUTPUT REQUIREMENT: Generate a BORDERLESS, FULL-BLEED image with NO FRAMES. NO film borders, NO film strips, NO sprocket holes, NO Kodak/Portra film frames, NO date stamps, NO margins. STYLE: High-resolution professional digital photography. Sharp focus, natural lighting, realistic textures.
           
           Avoid: ANY borders, frames, film strips, film sprockets, date stamps, film edges, white margins, black margins, text, watermarks, branding, CGI, airbrushed, plastic skin, excessive noise, film grain, blurry details.
           
           ${photoRealismNote}
           
           ${studioRunoutNote}
           ${environmentLightingNote}
           
           ${customPrompt ? `ADDITIONAL INSTRUCTIONS: ${customPrompt}` : ''}
           
           REMINDER-CAMERA ANGLE: The output MUST be shot from ${detailedAngle}. This is mandatory.
           
           REMINDER-FRAMING: The output MUST be ${framingLabel}. Match this framing exactly.
           
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
      STRICT ASPECT RATIO CHANGE TASK:
      
      ⚠️ CRITICAL - HOW TO HANDLE RESIZE:
      When changing aspect ratio (e.g. from Landscape to Portrait, or Banner to Square):
      1. MAINTAIN SUBJECT DISTANCE: Do NOT zoom out to fit more vertical space. Do NOT zoom in.
      2. MAINTAIN SUBJECT SIZE: The subject must remain the SAME SIZE relative to the frame pixels.
      3. CROP OR EXTEND ENVIRONMENT:
         - If going WIDER: Extend the background (outpaint).
         - If going TALLER/NARROWER: Crop the side edges of the environment.
      4. DO NOT CHANGE THE CAMERA DISTANCE. The model should not look further away or closer.
      
      FATAL ERROR: DO NOT ADD WHITE BARS, BLACK BARS, OR COLORED BORDERS.
      The output must be FULL-BLEED with NO MARGINS.
      
      ${PRODUCT_INTEGRITY_PROMPT}
      
      RULES:
      1. EXTEND THE ENVIRONMENT: Continue the pattern of the floor/wall/background seamlessly to the new edges.
      2. IGNORE BORDERS: If the input has borders, remove them. The output must be full-bleed.
      3. LIGHTING CONSISTENCY: New background areas must match the existing lighting direction and falloff.
      
      The result should be the EXACT same photo, just cropped or extended to fit the new size.
    `.trim();

    try {
      // NOTE: For variations/resize, we do NOT pass the model reference image.
      // We are only extending/cropping the EXISTING generated image.
      const generatedImages = await generateFashionAssets(
        activeAsset.imageUrl,
        variationPrompt,
        targetRatio,
        1, // Explicitly 1 for strict variation
        undefined // No model reference for resize operations
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
          'wide': 'full body head to toe',
          'medium': 'product focus',
          'close-up': 'product detail'
        }
      };
      return matrix[selectedProductType][framing];
    };

    const smartFraming = getSmartFramingForRefine(refineFraming);

    // Define notes locally for Refine scope using activeAsset.settingId
    const photoRealismNote = `
        PHOTOREALISM (CRITICAL-APPLIES TO EVERYTHING):
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
        5. IGNORE REFERENCE IMAGE DEFECTS: Even if the input/reference image shows runout, studio lights, or edges, YOU MUST FIX IT. Do not replicate the background flaws.
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

    // CHANGE DETECTION: Compare current asset settings with requested refine settings
    const currentAngle = activeAsset.cameraAngle || 'eye-level';
    const currentFraming = activeAsset.cameraFraming || 'medium';
    const currentPose = activeAsset.modelPose || 'standing';

    const angleChanged = refineAngle !== currentAngle;
    const framingChanged = refineFraming !== currentFraming;
    const poseChanged = refinePose !== currentPose;

    const anyChangeRequested = angleChanged || framingChanged || poseChanged;

    // Build dynamic change instructions
    const buildChangeInstructions = () => {
      const changes: string[] = [];
      const preserves: string[] = [];

      if (angleChanged) {
        let moveInstruction = '';
        if (currentAngle === 'low-angle' && (refineAngle === 'eye-level' || refineAngle === 'high-angle')) {
          moveInstruction = '⬆️ CAMERA MOVES UP: The camera must physically move UPWARD from the low position.';
        } else if (currentAngle === 'high-angle' && (refineAngle === 'eye-level' || refineAngle === 'low-angle')) {
          moveInstruction = '⬇️ CAMERA MOVES DOWN: The camera must physically move DOWNWARD from the high position.';
        } else if (currentAngle === 'eye-level') {
          moveInstruction = refineAngle === 'high-angle' ? '⬆️ CAMERA MOVES UP above subject.' : '⬇️ CAMERA MOVES DOWN below subject.';
        }

        changes.push(`🔄 CHANGE CAMERA ANGLE: From current to ${detailedAngle}
         ${moveInstruction}
         - LOW ANGLE: Camera BELOW subject, shooting UPWARD
         - HIGH ANGLE: Camera ABOVE subject, shooting DOWNWARD  
         - EYE LEVEL: Camera at subject's eye height, shooting STRAIGHT. NOT tilted up/down.`);
      } else {
        preserves.push(`✅ KEEP ANGLE SAME: Maintain the EXACT same camera angle as the input image`);
      }

      if (framingChanged) {
        const needsOutpainting = (currentFraming === 'close-up' && refineFraming !== 'close-up') ||
          (currentFraming === 'medium' && refineFraming === 'wide');

        changes.push(`🔄 VIRTUAL CAMERA MOVE-CHANGE FRAMING: From ${currentFraming} to ${smartFraming}
         - WIDE = Show FULL BODY (Head to Toe) + Environment. if zooming out, outpaint the missing legs/floor.
         - MEDIUM = Show WAIST UP. if zooming in from Wide, CROP OUT the legs and lower body.
         - CLOSE-UP = Show HEAD & SHOULDERS ONLY. if zooming in from Medium/Wide, CROP OUT the torso/legs.
         
         ${needsOutpainting
            ? '⚠️ ACTION: OUTPAINTING. Camera moves BACK. You must GENERATE missing body parts (legs/feet) and floor to fill the wider frame.'
            : '⚠️ ACTION: CROPPING/ZOOM. Camera moves CLOSER. You must DISCARD the outer parts of the image (legs, background edges) and FOCUS on the target area.'}`);
      } else {
        preserves.push(`✅ KEEP FRAMING SAME: The camera distance is fixed.`);
      }

      if (poseChanged) {
        changes.push(`🔄 CHANGE POSE: From current to ${poseLabel}
         - STANDING: On feet, upright posture
         - SITTING: Seated on surface
         - LEANING: Against wall or column
         - WALKING: Mid-stride, dynamic movement`);
      } else {
        preserves.push(`✅ KEEP POSE SAME: Maintain the EXACT same pose.`);
      }

      return { changes, preserves };
    };

    const { changes, preserves } = buildChangeInstructions();

    const refinePrompt = `

      SELECTIVE REFINEMENT TASK: Modify ONLY the specified aspects while preserving everything else.
      
      🚫 ABSOLUTE RULE-NO BORDERS:
      This image MUST be 100 % BORDERLESS.NO film borders, NO Kodak borders, NO margins.
      
      ⚠️ CRITICAL-WHAT TO PRESERVE(DO NOT CHANGE THESE):
- The BACKGROUND / ENVIRONMENT must remain EXACTLY THE SAME(unless cropping requires removing edges)
  - The MODEL IDENTITY(face, hair, body) must remain EXACTLY THE SAME
    - The PRODUCT / GARMENT must remain EXACTLY THE SAME
      - ALL PROPS the model is interacting with (chairs, stools, walls, objects they are leaning on) MUST be preserved
      
      🎨 STUDIO FLOOR RULE(VERY IMPORTANT):
      If this is a studio shot with a colored backdrop(brown, grey, white, etc):
- The FLOOR must be the SAME COLOR as the backdrop(infinite cyclorama)
  - A brown backdrop = brown floor(the model is standing on the seamless paper)
    - Do NOT add concrete, hardwood, or different flooring
      - Studio backdrops are seamless-wall and floor are the same color
      
      ${preserves.map(p => `      ${p}`).join('\n')}
      
      ${anyChangeRequested ? `
      🔄 WHAT TO CHANGE (ONLY THESE):
      ${changes.map(c => `      ${c}`).join('\n\n')}
      ` : 'NO CHANGES REQUESTED-output should match input exactly.'
      }
      
      ⛔ VERIFICATION:
      Before finalizing, verify:
      ${angleChanged ? `- Is the camera angle NOW "${detailedAngle}"? (MUST BE DIFFERENT from input)` : '- Is the camera angle UNCHANGED from input? (MUST BE SAME)'}
      ${framingChanged ? `- Is the framing NOW "${smartFraming}"? (MUST BE DIFFERENT from input)` : '- Is the framing UNCHANGED from input? (MUST BE SAME)'}
      ${poseChanged ? `- Is the pose NOW "${poseLabel}"? (MUST BE DIFFERENT from input)` : '- Is the pose UNCHANGED from input? (MUST BE SAME)'}
      If any verification fails, regenerate.
      
      ———————————————————————
      ———————————————————————
      ${PRODUCT_INTEGRITY_PROMPT}
      ———————————————————————
      
      ${photoRealismNote}
      
      ${studioRunoutNote}
      ${environmentLightingNote}
      ———————————————————————
    `.trim();

    try {
      // NOTE: For refinement, we do NOT pass the model reference image.
      // Refinement should only modify the CURRENT preview image (change angle/pose/framing).
      // Passing the model reference would cause the AI to recreate based on the reference
      // instead of just adjusting the existing generated image.
      const generatedImages = await generateFashionAssets(
        activeAsset.imageUrl,
        refinePrompt,
        activeAsset.ratio, // Keep current ratio
        1, // Explicitly 1 for strict refinement
        undefined // No model reference for refine operations
      );

      const newAssets: GeneratedAsset[] = generatedImages.map((img, index) => ({
        id: `${Date.now()
          } -${index} -refine`,
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
      }
    } else {
      setSavedReferenceModel(null);
    }

    // Always use Model Builder (not avatars) - just set preserve mode appropriately
    if (!asset.modelId) {
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

    if (window.confirm(`Are you sure you want to delete ${selectedAssetIds.size} images ? This cannot be undone.`)) {
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
      let filename = `lumiere - ${asset.id}.png`;

      // 1. Check Upscale
      if (shouldUpscale) {
        setIsUpscaling(true);
        try {
          // Upscale returns a data-URI (base64) from UpscalerJS
          downloadUrl = await upscaleImage(asset.imageUrl, "2x");
          filename = `lumiere - ${asset.id} -upscaled.png`;
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
      } else if (overlayPosition === 'top-right') {
        textX = img.width - padding;
        ctx.textAlign = 'right';
      } else if (overlayPosition === 'bottom-right') {
        textX = img.width - padding;
        textY = img.height - padding - Math.round(img.height * 0.1);
        ctx.textAlign = 'right';
      }

      // 5. Calculate Font Settings
      let fontScale = 1.0;
      if (overlayFontSize === 'small') fontScale = 0.8;
      if (overlayFontSize === 'large') fontScale = 1.25;

      const fontFamilyStr = `"${overlayFontFamily}", sans-serif`;

      // 5. Draw product name (if provided) - ALL BOLD
      let productNameBottomY = textY;
      if (overlayProductName) {
        const fontSize = Math.round(img.width * 0.04 * fontScale);
        ctx.font = `700 ${fontSize}px ${fontFamilyStr} `;
        ctx.fillStyle = overlayTextColor;

        // Split into lines ONLY if > 16 chars
        let line1 = overlayProductName;
        let line2 = '';

        if (overlayProductName.length > 16) {
          const words = overlayProductName.split(' ');
          const midpoint = Math.ceil(words.length / 2);
          line1 = words.slice(0, midpoint).join(' ');
          line2 = words.slice(midpoint).join(' ');
        }

        ctx.fillText(line1, textX, textY);
        productNameBottomY = textY;

        if (line2) {
          ctx.fillText(line2, textX, textY + fontSize * 1.1);
          productNameBottomY = textY + fontSize * 1.1;
        }
      }

      // 6. Draw Subheader (if provided)
      let subheaderBottomY = productNameBottomY;
      if (overlaySubheader) {
        const subheaderSize = Math.round(img.width * 0.025 * fontScale);
        ctx.font = `400 ${subheaderSize}px ${fontFamilyStr} `;
        ctx.fillStyle = overlayTextColor;

        // Spacing logic
        const padding = Math.round(img.width * 0.015);
        const spacing = overlayProductName ? (subheaderSize + padding) : 0;
        subheaderBottomY = productNameBottomY + spacing;

        ctx.fillText(overlaySubheader, textX, subheaderBottomY);
      }

      // 7. Draw prices (if provided)
      if (overlaySalePrice || overlayOriginalPrice) {
        const priceSize = Math.round(img.width * 0.035 * fontScale);

        const padding = Math.round(img.width * 0.02);
        const offset = overlaySubheader ? (priceSize + padding) : (priceSize + padding * 2);

        const priceY = subheaderBottomY + offset;

        if (overlayOriginalPrice && overlaySalePrice) {
          ctx.save();
          ctx.font = `400 ${priceSize}px ${fontFamilyStr} `;
          ctx.fillStyle = overlayTextColor;
          ctx.globalAlpha = 0.6;

          const originalText = `₹${overlayOriginalPrice} `;
          const originalWidth = ctx.measureText(originalText).width;
          ctx.fillText(originalText, textX, priceY);
          ctx.restore();

          // RED Strikethrough line
          ctx.beginPath();
          ctx.moveTo(textX, priceY - priceSize * 0.3);
          ctx.lineTo(textX + originalWidth, priceY - priceSize * 0.3);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Sale price-BOLD
          ctx.font = `700 ${priceSize * 1.2}px ${fontFamilyStr} `;
          ctx.fillStyle = overlayTextColor;
          ctx.fillText(`₹${overlaySalePrice} `, textX + originalWidth + 15, priceY);
        } else {
          // ONLY ONE price
          const thePrice = overlaySalePrice || overlayOriginalPrice;
          ctx.font = `700 ${priceSize}px ${fontFamilyStr} `;
          ctx.fillStyle = overlayTextColor;
          ctx.fillText(`₹${thePrice} `, textX, priceY);
        }
      }

      // 8. Draw watermark (if provided) - VERTICAL on right edge
      if (overlayWatermark) {
        const wmSize = Math.round(img.width * 0.018 * fontScale);
        ctx.save();

        ctx.translate(img.width - padding / 2, img.height / 2);
        ctx.rotate(-Math.PI / 2);

        ctx.font = `400 ${wmSize}px ${fontFamilyStr} `;
        ctx.fillStyle = overlayWatermarkColor;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 2;
        ctx.fillText(overlayWatermark, 0, 0);

        ctx.restore();
      }

      // 8. Export (and optionally upscale) and download
      let finalDataUrl = canvas.toDataURL('image/png');
      let filename = `lumiere - ${asset.id} -ad.png`;

      // Upscale if requested
      if (shouldUpscale) {
        setIsUpscaling(true);
        try {
          finalDataUrl = await upscaleImage(finalDataUrl, "2x");
          filename = `lumiere - ${asset.id} -ad-upscaled.png`;
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
                  <span className={`text-xs font-bold ${preserveOriginal ? 'text-yellow-400' : 'text-brand-200'} `}>
                    Keep Original Look
                  </span>
                  <span className="text-[10px] text-brand-500 leading-tight">
                    Disable model/setting changes. Only adjust camera.
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
                        className={`flex-1 min-w-[70px] py-1.5 text-[10px] font-medium rounded-md transition-all ${selectedProductType === pt.id ? 'bg-brand-700 text-white shadow-sm' : 'text-brand-500 hover:text-brand-300 hover:bg-brand-900'} `}
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
                        className={`flex-1 min-w-[80px] py-1.5 text-[10px] font-medium rounded-md transition-all ${selectedAngle === angle.id ? 'bg-brand-700 text-white shadow-sm' : 'text-brand-500 hover:text-brand-300 hover:bg-brand-900'} `}
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
                        className={`flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all ${selectedFraming === framing.id ? 'bg-brand-700 text-white shadow-sm' : 'text-brand-500 hover:text-brand-300 hover:bg-brand-900'} `}
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

            {/* 3. MODEL BUILDER */}
            <section className={`transition-all duration-300 ${preserveOriginal ? 'opacity-40 grayscale pointer-events-none select-none' : 'opacity-100'} `}>
              <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-brand-800 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                Build Model
              </h2>

              {/* Build Model Controls-Disabled when saved model is selected */}
              <div className={`transition-all duration-300 ${savedReferenceModel ? 'opacity-40 grayscale pointer-events-none select-none' : 'opacity-100'} `}>
                {savedReferenceModel && (
                  <p className="text-[10px] text-brand-500 mb-2 italic">Using saved model "{savedReferenceModel.name}" — Builder disabled</p>
                )}

                {/* Body Type-Segmented Buttons */}
                <div className="mb-4">
                  <p className="text-[10px] text-brand-400 mb-1.5 uppercase tracking-wider">Body Type</p>
                  <div className="flex flex-wrap gap-1">
                    {BODY_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => { setSelectedBodyType(type.id); setSavedReferenceModel(null); }}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-all
                        ${selectedBodyType === type.id
                            ? 'bg-white text-brand-950 border-white'
                            : 'bg-brand-950 border-brand-800 text-brand-500 hover:border-brand-600 hover:text-brand-300'
                          } `}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age-Segmented Buttons */}
                <div className="mb-4">
                  <p className="text-[10px] text-brand-400 mb-1.5 uppercase tracking-wider">Age</p>
                  <div className="flex flex-wrap gap-1">
                    {AGE_RANGES.map((age) => (
                      <button
                        key={age.id}
                        onClick={() => { setSelectedAge(age.id); setSavedReferenceModel(null); }}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-all
                        ${selectedAge === age.id
                            ? 'bg-white text-brand-950 border-white'
                            : 'bg-brand-950 border-brand-800 text-brand-500 hover:border-brand-600 hover:text-brand-300'
                          } `}
                      >
                        {age.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ethnicity-Dropdown */}
                <div className="mb-4">
                  <p className="text-[10px] text-brand-400 mb-1.5 uppercase tracking-wider">Ethnicity</p>
                  <select
                    value={selectedEthnicity}
                    onChange={(e) => { setSelectedEthnicity(e.target.value as Ethnicity); setSavedReferenceModel(null); }}
                    className="w-full bg-brand-950 border border-brand-800 rounded px-2 py-1.5 text-xs text-brand-300 focus:outline-none focus:border-brand-500"
                  >
                    {ETHNICITIES.map((eth) => (
                      <option key={eth.id} value={eth.id}>{eth.label}</option>
                    ))}
                  </select>
                </div>

                {/* Hair-Dropdown */}
                <div className="mb-4">
                  <p className="text-[10px] text-brand-400 mb-1.5 uppercase tracking-wider">Hair</p>
                  <select
                    value={selectedHair}
                    onChange={(e) => { setSelectedHair(e.target.value as HairStyle); setSavedReferenceModel(null); }}
                    className="w-full bg-brand-950 border border-brand-800 rounded px-2 py-1.5 text-xs text-brand-300 focus:outline-none focus:border-brand-500"
                  >
                    {HAIR_STYLES.map((hair) => (
                      <option key={hair.id} value={hair.id}>{hair.label}</option>
                    ))}
                  </select>
                </div>

                {/* Expression-Segmented Buttons */}
                <div className="mb-4">
                  <p className="text-[10px] text-brand-400 mb-1.5 uppercase tracking-wider">Expression</p>
                  <div className="flex flex-wrap gap-1">
                    {MODEL_EXPRESSIONS.map((expr) => (
                      <button
                        key={expr.id}
                        onClick={() => { setSelectedExpression(expr.id); setSavedReferenceModel(null); }}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-all
                        ${selectedExpression === expr.id
                            ? 'bg-white text-brand-950 border-white'
                            : 'bg-brand-950 border-brand-800 text-brand-500 hover:border-brand-600 hover:text-brand-300'
                          } `}
                      >
                        {expr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Saved Model Library-Always Active */}
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
            <section className={`transition-all duration-300 ${preserveOriginal ? 'opacity-40 grayscale pointer-events-none select-none' : 'opacity-100'} `}>
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
                        : 'bg-transparent text-brand-400 border-brand-800 hover:border-brand-600 hover:text-brand-200'
                      }
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
                      } `}
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

          {/* Main Workspace-SCROLLABLE */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 flex flex-col items-center w-full custom-scrollbar pb-20 md:pb-8">
            {activeAsset ? (
              <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in duration-500">

                {/* Main Image Card-No height restriction, scrollable parent */}
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
  p-2 md: p-3 rounded-full shadow-lg backdrop-blur-md transition-all flex items-center justify-center hover: scale-110 active: scale-95
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
                    <ChevronDown size={14} className={`text-brand-400 transition-transform ${showOverlayPanel ? 'rotate-180' : ''} `} />
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

                      {/* Subheader (NEW) */}
                      <div>
                        <label className="text-[10px] text-brand-400 block mb-1">Subheader</label>
                        <input
                          type="text"
                          value={overlaySubheader}
                          onChange={(e) => setOverlaySubheader(e.target.value)}
                          placeholder="Limited Edition Collection"
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
                            onChange={(e) => setOverlayPosition(e.target.value as 'top-left' | 'center' | 'bottom-left' | 'top-right' | 'bottom-right')}
                            className="w-full bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none"
                          >
                            <option value="top-left">Top Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="center">Center</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-right">Bottom Right</option>
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

                      {/* Typography Row (NEW) */}
                      <div className="flex gap-2">
                        {/* Font Size */}
                        <div className="flex-1">
                          <label className="text-[10px] text-brand-400 block mb-1">Font Size</label>
                          <div className="flex bg-brand-950 border border-brand-600 rounded overflow-hidden">
                            {/* Small */}
                            <button
                              onClick={() => setOverlayFontSize('small')}
                              className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${overlayFontSize === 'small' ? 'bg-brand-700 text-white' : 'text-brand-400 hover:text-brand-200'} `}
                            >Sm</button>
                            <div className="w-[1px] bg-brand-800"></div>
                            {/* Medium */}
                            <button
                              onClick={() => setOverlayFontSize('medium')}
                              className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${overlayFontSize === 'medium' ? 'bg-brand-700 text-white' : 'text-brand-400 hover:text-brand-200'} `}
                            >Md</button>
                            <div className="w-[1px] bg-brand-800"></div>
                            {/* Large */}
                            <button
                              onClick={() => setOverlayFontSize('large')}
                              className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${overlayFontSize === 'large' ? 'bg-brand-700 text-white' : 'text-brand-400 hover:text-brand-200'} `}
                            >Lg</button>
                          </div>
                        </div>

                        {/* Font Family */}
                        <div className="flex-[1.5]">
                          <label className="text-[10px] text-brand-400 block mb-1">Font Family</label>
                          <div className="relative">
                            <select
                              value={overlayFontFamily}
                              onChange={(e) => setOverlayFontFamily(e.target.value as any)}
                              className="w-full bg-brand-950 border border-brand-600 text-brand-200 text-xs rounded px-2 py-1.5 focus:outline-none appearance-none"
                            >
                              <option value="Inter">Classic Sans</option>
                              <option value="Playfair Display">Elegant Serif</option>
                              <option value="Montserrat">Modern Sans</option>
                              <option value="Roboto">Neutral Sans</option>
                            </select>
                            <div className="absolute right-2 top-1.5 pointer-events-none text-brand-400">
                              <ChevronDown size={12} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Colors Row */}
                      <div className="flex gap-4">
                        {/* Main Text Color */}
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-brand-400 whitespace-nowrap">Text Color</label>
                          <div className="flex gap-1">
                            {['#ffffff', '#000000', '#f5f5dc', '#1e293b'].map((color) => (
                              <button
                                key={color}
                                onClick={() => setOverlayTextColor(color)}
                                className={`w-4 h-4 rounded-full border border-gray-600 ${overlayTextColor === color ? 'ring-2 ring-brand-400 scale-110' : ''} `}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <input
                              type="color"
                              value={overlayTextColor}
                              onChange={(e) => setOverlayTextColor(e.target.value)}
                              className="w-5 h-5 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Watermark Color */}
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-brand-400 whitespace-nowrap">Watermark Color</label>
                          <div className="flex gap-1">
                            {['#ffffff', '#000000', '#f5f5dc', '#1e293b'].map((color) => (
                              <button
                                key={`wm - ${color} `}
                                onClick={() => setOverlayWatermarkColor(color)}
                                className={`w-4 h-4 rounded-full border border-gray-600 ${overlayWatermarkColor === color ? 'ring-2 ring-brand-400 scale-110' : ''} `}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <input
                              type="color"
                              value={overlayWatermarkColor}
                              onChange={(e) => setOverlayWatermarkColor(e.target.value)}
                              className="w-5 h-5 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                            />
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
                    download={`lumiere - ${activeAsset.id}.png`}
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
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'all' ? 'border-brand-400 text-white' : 'border-transparent text-brand-500 hover:text-brand-300'} `}
                >
                  <History size={12} /> Session ({generatedAssets.length})
                </button>
                <button
                  onClick={() => setActiveTab('shortlist')}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'shortlist' ? 'border-brand-400 text-white' : 'border-transparent text-brand-500 hover:text-brand-300'} `}
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
