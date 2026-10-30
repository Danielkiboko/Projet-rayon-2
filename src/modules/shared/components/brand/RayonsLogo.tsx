import React from "react";
import Link from "next/link";
import { RayonsMark } from "./RayonsMark";

export type RayonUniverse = "connect" | "immo" | "mode" | "saveurs";

interface RayonsLogoProps {
  variant?: "dark" | "light" | "monochrome-white" | "monochrome-dark";
  rayon?: RayonUniverse;
  withDomain?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  href?: string;
}

export function RayonsLogo({
  variant = "dark",
  rayon,
  withDomain = true,
  size = "md",
  className = "",
  href = "/"
}: RayonsLogoProps) {
  // Déterminer la couleur du symbole et du texte
  let markColor = "#C7D300"; // Vert Rayons officiel
  let textColor = "#FFFFFF"; // Blanc par défaut pour nos headers sombres #0F1D27

  if (variant === "light") {
    markColor = "#C7D300";
    textColor = "#0F1D27";
  } else if (variant === "monochrome-white") {
    markColor = "#FFFFFF";
    textColor = "#FFFFFF";
  } else if (variant === "monochrome-dark") {
    markColor = "#0F1D27";
    textColor = "#0F1D27";
  }

  // Dimensions selon size
  const config = {
    sm: { markSize: 24, textSize: "text-lg", domainSize: "text-xs", badgeSize: "text-[10px] px-1.5 py-0.5" },
    md: { markSize: 32, textSize: "text-2xl", domainSize: "text-sm", badgeSize: "text-xs px-2 py-0.5" },
    lg: { markSize: 42, textSize: "text-3xl", domainSize: "text-base", badgeSize: "text-xs px-2.5 py-1" },
    xl: { markSize: 56, textSize: "text-4xl", domainSize: "text-lg", badgeSize: "text-sm px-3 py-1" },
  }[size];

  // Univers spécifique
  const universeConfig: Record<RayonUniverse, { label: string; colorClass: string; hex: string }> = {
    connect: { label: ".CONNECT", colorClass: "text-[#00B5A5] border-[#00B5A5]/30 bg-[#00B5A5]/10", hex: "#00B5A5" },
    immo: { label: ".IMMO", colorClass: "text-[#4C6EF5] border-[#4C6EF5]/30 bg-[#4C6EF5]/10", hex: "#4C6EF5" },
    mode: { label: ".MODE", colorClass: "text-[#D4B08C] border-[#D4B08C]/30 bg-[#D4B08C]/10", hex: "#D4B08C" },
    saveurs: { label: ".SAVEURS", colorClass: "text-[#FF6B35] border-[#FF6B35]/30 bg-[#FF6B35]/10", hex: "#FF6B35" },
  };

  const currentUniverse = rayon ? universeConfig[rayon] : null;

  const content = (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Emblème ailé officiel */}
      <RayonsMark size={config.markSize} color={markColor} />
      
      {/* Typographie Montserrat du Logo */}
      <div className="flex items-baseline tracking-tight">
        <span 
          className={`font-heading font-extrabold tracking-tight ${config.textSize}`}
          style={{ color: textColor }}
        >
          Rayons
        </span>
        
        {withDomain && !currentUniverse && (
          <span 
            className={`font-heading font-medium ${config.domainSize} ml-0.5 opacity-80`}
            style={{ color: variant === "dark" ? "#C7D300" : textColor }}
          >
            .net
          </span>
        )}

        {currentUniverse && (
          <span 
            className={`font-heading font-bold uppercase tracking-wider rounded-md border ml-1.5 ${config.badgeSize} ${currentUniverse.colorClass}`}
          >
            {currentUniverse.label}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group transition-opacity hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
}
