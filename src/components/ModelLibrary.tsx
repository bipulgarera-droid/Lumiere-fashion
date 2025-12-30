import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';
import { modelLibrary, SavedModel } from '../services/supabaseService';

interface ModelLibraryProps {
    onSelectModel: (model: SavedModel) => void;
    selectedModelId?: string;
    onSaveCurrentModel?: (name: string, description: string) => Promise<void>;
    currentImage?: string | null;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({
    onSelectModel,
    selectedModelId,
    onSaveCurrentModel,
    currentImage
}) => {
    const [models, setModels] = useState<SavedModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [newModelDescription, setNewModelDescription] = useState('');

    // Load saved models on mount
    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async () => {
        setLoading(true);
        const savedModels = await modelLibrary.getModels();
        setModels(savedModels);
        setLoading(false);
    };

    const handleSaveModel = async () => {
        if (!newModelName.trim() || !currentImage) return;

        setSaving(true);
        try {
            if (onSaveCurrentModel) {
                await onSaveCurrentModel(newModelName, newModelDescription);
            }
            // Refresh the model list
            await loadModels();
            setShowSaveForm(false);
            setNewModelName('');
            setNewModelDescription('');
        } catch (error) {
            console.error('Failed to save model:', error);
        }
        setSaving(false);
    };

    const handleDeleteModel = async (id: string) => {
        if (!confirm('Delete this model?')) return;
        await modelLibrary.deleteModel(id);
        setModels(models.filter(m => m.id !== id));
    };

    return (
        <div className="space-y-3">
            {/* Header with Save Button */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-brand-300 uppercase tracking-wider">
                    My Models
                </h4>
                {currentImage && (
                    <button
                        onClick={() => setShowSaveForm(true)}
                        className="flex items-center gap-1 text-xs text-brand-400 hover:text-white transition-colors"
                    >
                        <Plus size={14} />
                        Save Current
                    </button>
                )}
            </div>

            {/* Save Form */}
            {showSaveForm && (
                <div className="bg-brand-900 border border-brand-700 rounded-lg p-3 space-y-2">
                    <input
                        type="text"
                        placeholder="Model name..."
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        className="w-full bg-brand-800 border border-brand-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-brand-500 focus:outline-none focus:border-brand-500"
                    />
                    <input
                        type="text"
                        placeholder="Description (optional)"
                        value={newModelDescription}
                        onChange={(e) => setNewModelDescription(e.target.value)}
                        className="w-full bg-brand-800 border border-brand-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-brand-500 focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveModel}
                            disabled={!newModelName.trim() || saving}
                            className="flex-1 flex items-center justify-center gap-1 bg-white text-brand-950 py-1.5 rounded text-sm font-medium hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={() => setShowSaveForm(false)}
                            className="px-3 bg-brand-800 text-brand-300 py-1.5 rounded text-sm hover:bg-brand-700"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Model Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-8 text-brand-500">
                    <Loader2 size={20} className="animate-spin" />
                </div>
            ) : models.length === 0 ? (
                <div className="text-center py-6 text-brand-500 text-sm">
                    <User size={24} className="mx-auto mb-2 opacity-50" />
                    <p>No saved models yet</p>
                    <p className="text-xs mt-1">Generate an image and save the model to reuse it</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    {models.map((model) => (
                        <div
                            key={model.id}
                            onClick={() => onSelectModel(model)}
                            className={`
                relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                ${selectedModelId === model.id
                                    ? 'border-white ring-2 ring-white/20'
                                    : 'border-transparent hover:border-brand-600'
                                }
              `}
                        >
                            <img
                                src={model.image_url}
                                alt={model.name}
                                className="w-full aspect-[3/4] object-cover"
                            />
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                            {/* Name */}
                            <div className="absolute bottom-0 left-0 right-0 p-2">
                                <p className="text-white text-xs font-medium truncate">{model.name}</p>
                            </div>

                            {/* Selected indicator */}
                            {selectedModelId === model.id && (
                                <div className="absolute top-2 right-2 bg-white text-brand-950 rounded-full p-1">
                                    <Check size={12} />
                                </div>
                            )}

                            {/* Delete button (on hover) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteModel(model.id);
                                }}
                                className="absolute top-2 left-2 p-1.5 bg-red-500/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ModelLibrary;
