import React from 'react';
import { Heart, User, Trash2 } from 'lucide-react';
import { GeneratedAsset } from '../types';

interface AssetCardProps {
  asset: GeneratedAsset;
  onSelect: (asset: GeneratedAsset) => void;
  isActive: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onSelect, isActive, selectionMode = false, isSelected = false }) => {
  return (
    <div
      onClick={() => onSelect(asset)}
      className={`
        group relative flex-shrink-0 h-16 w-16 md:h-20 md:w-20 rounded-lg overflow-hidden cursor-pointer transition-all duration-300
        bg-brand-800 border 
        ${selectionMode
          ? (isSelected ? 'border-green-500 ring-2 ring-green-500/50 scale-95 opacity-100' : 'border-brand-700 opacity-60 hover:opacity-90')
          : (isActive ? 'border-brand-400 ring-1 ring-white scale-105 z-10 shadow-lg opacity-100' : 'border-brand-700 opacity-80 hover:opacity-100')
        }
      `}
    >
      <img
        src={asset.imageUrl}
        alt="Asset"
        className="w-full h-full object-cover"
        loading="eager"
      />

      {/* Overlay */}
      <div className={`
        absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors
        ${isActive ? 'bg-transparent' : ''}
      `} />

      {/* Selection Indicator */}
      {selectionMode && (
        <div className={`absolute top-1 left-1 rounded-full p-0.5 ${isSelected ? 'bg-green-500 text-white' : 'bg-black/40 border border-white/30'}`}>
          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
          {!isSelected && <div className="w-2 h-2 rounded-full" />}
        </div>
      )}

      {/* Icons (Top Right) - Only show if NOT in selection mode to reduce clutter */}
      {!selectionMode && (
        <div className="absolute top-1 right-1 flex flex-col gap-1">
          {asset.isShortlisted && (
            <div className="p-0.5 bg-brand-500 rounded-full text-white shadow-sm">
              <Heart size={6} fill="currentColor" />
            </div>
          )}
          {asset.modelId && (
            <div className="p-0.5 bg-blue-500 rounded-full text-white shadow-sm">
              <User size={6} fill="currentColor" />
            </div>
          )}
        </div>
      )}

      {/* Hover Label */}
      <div className="absolute bottom-0 inset-x-0 p-0.5 bg-black/60 backdrop-blur-[1px] flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[7px] text-white/90 font-mono uppercase tracking-tighter">{asset.ratio}</span>
      </div>
    </div>
  );
};

export default AssetCard;