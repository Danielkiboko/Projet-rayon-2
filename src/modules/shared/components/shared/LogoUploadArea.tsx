"use client";

import React, { useRef, useState } from "react";
import { Upload, X, Sparkles, Zap, Building2, CheckCircle2 } from "lucide-react";
import { optimizeImageToWebP, OptimizedImageResult } from "@/lib/imageOptimizer";

interface LogoUploadAreaProps {
  logoUrl: string | null;
  onLogoChange: (webpDataUrl: string, result?: OptimizedImageResult) => void;
  onClear: () => void;
  companyName?: string;
  disabled?: boolean;
}

export default function LogoUploadArea({
  logoUrl,
  onLogoChange,
  onClear,
  companyName = "Entreprise",
  disabled = false,
}: LogoUploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [optimizationStats, setOptimizationStats] = useState<{
    originalSize: string;
    compressedSize: string;
    savedPercentage: number;
  } | null>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner un fichier image valide (PNG, JPG, SVG, WebP).");
      return;
    }

    setIsConverting(true);
    try {
      // Optimise et convertit tout format (PNG, JPG) en image/webp ultra-léger avec canal alpha préservé
      const result = await optimizeImageToWebP(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.88,
        maxSizeMB: 0.1, // ~100KB max, généralement 20KB-40KB
      });

      setOptimizationStats({
        originalSize: result.originalFormatted,
        compressedSize: result.compressedFormatted,
        savedPercentage: result.savedPercentage,
      });

      onLogoChange(result.dataUrl, result);
    } catch (err) {
      console.error("Erreur conversion logo WebP:", err);
      // Fallback: lire le fichier tel quel
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onLogoChange(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsConverting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const isWebP = logoUrl?.startsWith("data:image/webp") || logoUrl?.includes(".webp");

  return (
    <div className="space-y-3 font-sans">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        disabled={disabled || isConverting}
      />

      {!logoUrl ? (
        <div
          onClick={() => !disabled && !isConverting && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${
            isDragging
              ? "border-[#C7D300] bg-[#C7D300]/10 scale-[0.99]"
              : "border-white/15 hover:border-[#C7D300]/60 bg-black/25 hover:bg-black/35"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#C7D300] shadow-sm">
              {isConverting ? (
                <div className="w-6 h-6 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload size={24} />
              )}
            </div>
          </div>

          <p className="text-white font-bold text-sm mb-1">
            {isConverting ? "Optimisation WebP en cours..." : "Téléverser le logo de l'entreprise"}
          </p>
          <p className="text-xs text-gray-400 mb-3 max-w-sm mx-auto">
            PNG (avec transparence), JPG ou WebP. Converti automatiquement au format Web ultra-léger pour votre profil et vos factures.
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C7D300]/10 border border-[#C7D300]/30 text-[#C7D300] text-[11px] font-semibold">
            <Zap size={13} className="text-[#C7D300]" />
            <span>Format WebP automatique • Apparaîtra sur vos devis & factures</span>
          </div>
        </div>
      ) : (
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Visualisation du logo avec fond transparent damier */}
            <div className="w-28 h-28 shrink-0 rounded-xl bg-white/5 border border-white/15 p-2 flex items-center justify-center relative overflow-hidden shadow-inner">
              <img
                src={logoUrl}
                alt={`Logo ${companyName}`}
                className="max-w-full max-h-full object-contain filter drop-shadow-sm"
              />
            </div>

            {/* Informations & statut WebP */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="text-xs font-bold text-white truncate max-w-[200px]">
                  {companyName}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <CheckCircle2 size={12} />
                  <span>{isWebP ? "WebP Optimisé" : "Logo Chargé"}</span>
                </span>
              </div>

              <p className="text-xs text-gray-400 mb-2">
                Ce logo officiel figurera en tête de vos quittances de loyer, factures de séjour et proformas de commande.
              </p>

              {optimizationStats && (
                <div className="inline-flex items-center gap-2 text-[11px] text-gray-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 mb-3">
                  <Sparkles size={12} className="text-[#C7D300]" />
                  <span>
                    Compressé de <strong>{optimizationStats.originalSize}</strong> à <strong>{optimizationStats.compressedSize}</strong> ({optimizationStats.savedPercentage}% d'économie)
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isConverting}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg border border-white/10 transition-colors flex items-center gap-1.5"
                >
                  <Upload size={13} />
                  <span>Changer de logo</span>
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={disabled}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border border-red-500/20 transition-colors flex items-center gap-1.5"
                >
                  <X size={13} />
                  <span>Supprimer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
