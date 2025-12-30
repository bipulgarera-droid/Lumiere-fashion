
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
  ChevronRight
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
  MODEL_POSES
} from './constants';
import {
  GeneratedAsset,
  AvatarPreset,
  SettingPreset,
  AspectRatio,
  GenerationStatus,
  CameraAngle,
  CameraFraming,
  ModelPose
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

  // Refine Controls (Right Panel - Local)
  const [refineAngle, setRefineAngle] = useState<CameraAngle>('eye-level');
  const [refineFraming, setRefineFraming] = useState<CameraFraming>('medium');
  const [refinePose, setRefinePose] = useState<ModelPose>('standing');

  // Conditional Configuration (Disabled if Preserve Mode is ON)
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarPreset | null>(AVATARS[0]);
  const [selectedSetting, setSelectedSetting] = useState<SettingPreset | null>(SETTINGS[0]);

  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(AspectRatio.Portrait);
  const [customPrompt, setCustomPrompt] = useState<string>('');

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
      case 'low-angle': return "EXTREME LOW ANGLE, worm's-eye view, camera placed low looking UP at the subject";
      case 'high-angle': return "HIGH ANGLE, camera placed above looking DOWN, bird's-eye perspective";
      case 'side-angle': return "SIDE PROFILE VIEW, 90-degree side shot of the subject, profile silhouette";
      default: return "EYE LEVEL, straight-on neutral camera angle";
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
    const framingLabel = CAMERA_FRAMINGS.find(f => f.id === selectedFraming)?.label || 'Medium Shot';
    const poseLabel = MODEL_POSES.find(p => p.id === selectedPose)?.label || 'Standing';

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

      if (preserveOriginal) {
        // Mode: Preserve original subject/bg, just change camera params
        fullPrompt = `
          COMPOSITION INSTRUCTION: Generate a ${framingLabel} shot.
          CAMERA ANGLE: ${detailedAngle}.
          SUBJECT POSE: The model should be ${poseLabel}.
          
          TASK: Editorial fashion photography. Retain the EXACT subject, clothing, and background from the input image.
          
          CRITICAL: Do NOT change the model's identity or the environment. Only adjust the camera perspective and framing as requested above.
          
          ${highFidelityMode
            ? highFiStyle
            : `STYLE: Shot on 35mm film, Kodak Portra 400, natural sunlight, candid movement, film grain, authentic skin texture.
           Avoid: film borders, film frame, white border, black border, text, watermarks.`
          }
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
            ? `CHARACTER CONSISTENCY: Use the identity and features of the model in the provided second reference image (the one NOT showing the garment). Maintain her face, hair, and overall appearance exactly.`
            : `TARGET MODEL: ${selectedAvatar?.description || 'A fashion model'}.`
          }
           
           POSE: ${poseLabel}.
           IMPORTANT: Focus on the garment texture and fit. If the reference has a person, replace them with the specified model.
           
           SETTING: ${selectedSetting?.description}.
           
           ${highFidelityMode
            ? highFiStyle
            : 'STYLE: Shot on 35mm film, Kodak Portra 400, natural sunlight, candid movement, film grain, authentic skin texture, unretouched aesthetic, depth of field.'
          }
           
           ${highFidelityMode
            ? highFiAvoid
            : 'Avoid: film borders, film frame, white border, black border, text, watermarks, branding, CGI, airbrushed, artificial lighting, plastic skin, over-sharpened, commercial catalog look.'
          }
           ${customPrompt ? `ADDITIONAL INSTRUCTIONS: ${customPrompt}` : ''}
         `.trim();
      }

      // 3. Generate Assets
      const generatedImages = await generateFashionAssets(
        uploadedImage,
        fullPrompt,
        targetRatio,
        3, // count
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

    const framingLabel = CAMERA_FRAMINGS.find(f => f.id === refineFraming)?.label;
    const poseLabel = MODEL_POSES.find(p => p.id === refinePose)?.label;
    const detailedAngle = getDetailedAngleDescription(refineAngle);

    const refinePrompt = `
      STRICT REFINEMENT TASK.
      
      Goal: Modify ONLY the Camera and Pose details of the input image.
      
      TARGET VISUALS:
      - Camera Angle: ${detailedAngle}
      - Framing: ${framingLabel}
      - Model Pose: ${poseLabel}
      
      CRITICAL INSTRUCTIONS - READ CAREFULLY:
      1. COLOR LOCK: The garment in the output MUST MATCH the input image exactly in color (hex code), fabric, and pattern. 
         If the input garment is dark blue, the output must be dark blue. DO NOT LIGHTEN OR DARKEN THE GARMENT.
      2. IDENTITY LOCK: Keep the EXACT same model identity (face, body, ethnicity).
      3. SETTING LOCK: Keep the EXACT same environment/background.
      
      ACTION: Re-shoot the exact same scene/model/garment with the new camera angle/framing or pose specified above.
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
                    High Fidelity Mode
                  </span>
                  <span className="text-[10px] text-brand-500 leading-tight">
                    Strict color accuracy. Reduces artistic styling to preserve garment details.
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
          <div className="p-4 bg-brand-950/95 backdrop-blur-sm border-t border-brand-800 sticky bottom-0 z-30">
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

          {/* Main Workspace */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center w-full custom-scrollbar pb-20 md:pb-8">
            {activeAsset ? (
              <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in duration-500">

                {/* Main Image Card */}
                <div className="relative group rounded-xl overflow-hidden shadow-2xl shadow-black bg-brand-950 border border-brand-800 self-center max-w-full transition-all duration-500">
                  <img
                    src={activeAsset.imageUrl}
                    alt="Result"
                    className="max-h-[40vh] md:max-h-[55vh] object-contain w-auto"
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
