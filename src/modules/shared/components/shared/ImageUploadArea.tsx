import React, { RefObject, useState } from "react";
import { Image as ImageIcon, X, Sparkles, Zap } from "lucide-react";

interface ImageUploadAreaProps {
  imagePreview: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onUrlChange: (url: string) => void;
}

export default function ImageUploadArea({
  imagePreview,
  fileInputRef,
  handleImageUpload,
  onClear,
  onUrlChange
}: ImageUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fakeEvent = {
        target: {
          files: e.dataTransfer.files
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleImageUpload(fakeEvent);
    }
  };

  const isWebP = imagePreview?.startsWith("data:image/webp") || imagePreview?.includes(".webp");

  if (!imagePreview) {
    return (
      <div 
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer bg-black/20 relative ${
          isDragging ? "border-[#C7D300] bg-[#C7D300]/10 scale-[0.99]" : "border-white/20 hover:border-primary/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          className="hidden" 
          accept="image/*" 
        />
        <div className="flex justify-center mb-3">
          <div className="p-3.5 bg-white/5 rounded-full text-primary-light">
            <ImageIcon size={28} />
          </div>
        </div>
        <p className="text-white font-medium text-sm mb-1">Cliquez ou glissez-déposez une photo</p>
        <p className="text-xs text-gray-400 mb-3">JPG, PNG, HEIC ou WEBP (Appareil photo, galerie ou fichier)</p>
        
        {/* WebP Auto Conversion Badge */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C7D300]/10 border border-[#C7D300]/30 text-[#C7D300] text-[11px] font-semibold">
          <Zap size={13} className="text-[#C7D300]" />
          <span>Conversion automatique WebP (site léger & rapide)</span>
        </div>
        
        <div className="mt-4 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs text-gray-400 mb-2">Ou utiliser une URL d'image externe :</p>
          <input 
            type="url" 
            placeholder="https://..." 
            onChange={(e) => {
              if (e.target.value) onUrlChange(e.target.value);
            }}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary placeholder:text-gray-500"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden h-44 bg-black/40 flex items-center justify-center border border-white/10 group">
        <img src={imagePreview} alt="Aperçu photo" className="max-h-full max-w-full object-contain" />
        
        {/* Status indicator badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-medium text-emerald-400">
          <Sparkles size={12} className="text-emerald-400" />
          <span>{isWebP ? "Format WebP Optimisé" : "Photo Prête"}</span>
        </div>
      </div>
      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] text-gray-400">Photo prête pour publication</span>
        <button 
          type="button"
          onClick={onClear}
          className="flex items-center space-x-1.5 text-xs text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 px-3 py-1.5 rounded-lg transition"
        >
          <X size={14} />
          <span>Changer de photo</span>
        </button>
      </div>
    </div>
  );
}
