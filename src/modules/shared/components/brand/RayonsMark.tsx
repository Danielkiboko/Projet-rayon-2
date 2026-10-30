import React from "react";

interface RayonsMarkProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export function RayonsMark({ 
  className = "", 
  size = 32, 
  color = "#C7D300" 
}: RayonsMarkProps) {
  const numSize = typeof size === "number" ? size : parseInt(String(size), 10) || 32;

  let markSrc = "/brand/rayons-mark-green.png";
  if (color === "#FFFFFF" || color?.toLowerCase() === "white") {
    markSrc = "/brand/rayons-mark-white.png";
  } else if (color === "#0F1D27" || color === "dark") {
    markSrc = "/brand/rayons-mark-dark.png";
  }

  return (
    <img
      src={markSrc}
      width={numSize}
      height={numSize}
      alt="Logo Rayons"
      className={`inline-block flex-shrink-0 object-contain select-none transition-transform group-hover:scale-105 ${className}`}
      style={{ width: `${numSize}px`, height: `${numSize}px` }}
      loading="eager"
      decoding="async"
    />
  );
}

