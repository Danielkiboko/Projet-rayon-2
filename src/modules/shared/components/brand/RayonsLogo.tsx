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

  // Dimensions selon size (responsive sur mobile pour éviter tout chevauchement en 360px)
  const config = {
    sm: { markSize: 24, markClass: "w-6 h-6", textSize: "text-base sm:text-lg", domainSize: "text-[11px] sm:text-xs", badgeSize: "text-[9px] sm:text-[10px] px-1.5 py-0.5" },
    md: { markSize: 32, markClass: "w-6 h-6 sm:w-8 sm:h-8", textSize: "text-[17px] sm:text-2xl", domainSize: "text-[11px] sm:text-sm", badgeSize: "text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5" },
    lg: { markSize: 42, markClass: "w-9 h-9 sm:w-[42px] sm:h-[42px]", textSize: "text-2xl sm:text-3xl", domainSize: "text-sm sm:text-base", badgeSize: "text-xs px-2.5 py-1" },
    xl: { markSize: 56, markClass: "w-12 h-12 sm:w-14 sm:h-14", textSize: "text-3xl sm:text-4xl", domainSize: "text-base sm:text-lg", badgeSize: "text-sm px-3 py-1" },
  }[size];

  // Univers spécifique
  const universeConfig: Record<RayonUniverse, { label: string; colorClass: string; hex: string }> = {
    connect: { label: ".CONNECT", colorClass: "text-[#00B5A5] border-[#00B5A5]/30 bg-[#00B5A5]/10", hex: "#00B5A5" },
    immo: { label: ".IMMO", colorClass: "text-[#4C6EF5] border-[#4C6EF5]/30 bg-[#4C6EF5]/10", hex: "#4C6EF5" },
    mode: { label: ".MODE", colorClass: "text-[#D4B08C] border-[#D4B08C]/30 bg-[#D4B08C]/10", hex: "#D4B08C" },
    saveurs: { label: ".SAVEURS", colorClass: "text-[#FF6B35] border-[#FF6B35]/30 bg-[#FF6B35]/10", hex: "#FF6B35" },
  };

  const currentUniverse = rayon ? universeConfig[rayon] : null;

  const innerContent = (
    <div className="inline-flex items-center gap-1.5 sm:gap-2 select-none whitespace-nowrap shrink-0" translate="no" data-no-translate="true">
      {/* Emblème ailé officiel */}
      <RayonsMark size={config.markSize} className={config.markClass} color={markColor} />
      
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
            className={`font-heading font-bold ${config.domainSize} ml-0.5`}
            style={{
              color:
                variant === "dark"
                  ? "#C7D300"
                  : variant === "light"
                  ? "#9EAC00"
                  : textColor,
            }}
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

  const baseClasses = "items-center group transition-opacity hover:opacity-95";
  const displayClass = className.includes("hidden") ? "" : "inline-flex";

  if (href) {
    return (
      <Link href={href} className={`${displayClass} ${baseClasses} ${className}`}>
        {innerContent}
      </Link>
    );
  }

  return (
    <div className={`${displayClass} items-center ${className}`}>
      {innerContent}
    </div>
  );
}
