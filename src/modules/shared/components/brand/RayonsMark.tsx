import React from "react";

interface RayonsMarkProps {
  className?: string;
  size?: number | string;
  color?: string;
  withBadge?: boolean;
}

export function RayonsMark({
  className = "",
  size = 32,
  color = "#C7D300",
  withBadge = true,
}: RayonsMarkProps) {
  const numSize = typeof size === "number" ? size : parseInt(String(size), 10) || 32;

  const isWhite = color === "#FFFFFF" || color?.toLowerCase() === "white";
  const isDarkMono = color === "#0F1D27" || color === "dark";
  const fillWing = isWhite ? "#FFFFFF" : isDarkMono ? "#0F1D27" : "#C7D300";

  if (withBadge && !isWhite && !isDarkMono) {
    return (
      <svg
        width={numSize}
        height={numSize}
        viewBox="0 0 1024 1024"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Icône Rayons"
        className={`inline-block shrink-0 select-none transition-transform group-hover:scale-105 rounded-lg shadow-xs ${className}`}
        style={{ width: `${numSize}px`, height: `${numSize}px` }}
      >
        <rect width="1024" height="1024" rx="220" fill="#0F1D27" />
        <rect
          x="16"
          y="16"
          width="992"
          height="992"
          rx="204"
          stroke="#C7D300"
          strokeOpacity="0.35"
          strokeWidth="24"
        />
        <circle cx="512" cy="512" r="420" fill="#152836" fillOpacity="0.55" />
        <g transform="translate(195, 215) scale(1.56)">
          <path
            d="M 136.0 2.0 L 403.0 2.0 L 383.0 10.0 L 376.0 17.0 L 365.0 50.0 L 355.0 68.0 L 347.0 75.0 L 331.0 80.0 L 68.0 80.0 L 69.0 72.0 L 80.0 40.0 L 89.0 24.0 L 100.0 14.0 L 111.0 8.0 L 135.0 3.0 Z"
            fill="#C7D300"
          />
          <path
            d="M 100.0 150.0 L 327.0 150.0 L 316.0 191.0 L 304.0 213.0 L 293.0 222.0 L 273.0 229.0 L 29.0 229.0 L 36.0 196.0 L 40.0 185.0 L 48.0 172.0 L 56.0 164.0 L 66.0 158.0 L 85.0 152.0 L 99.0 151.0 Z"
            fill="#C7D300"
          />
          <path
            d="M 67.0 299.0 L 275.0 299.0 L 273.0 311.0 L 264.0 339.0 L 254.0 356.0 L 240.0 368.0 L 229.0 373.0 L 213.0 377.0 L 15.0 377.0 L 5.0 372.0 L 1.0 362.0 L 3.0 346.0 L 12.0 324.0 L 23.0 312.0 L 34.0 306.0 L 51.0 301.0 L 66.0 300.0 Z"
            fill="#C7D300"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      width={numSize}
      height={numSize}
      viewBox="0 0 406 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Logo Rayons"
      className={`inline-block shrink-0 select-none transition-transform group-hover:scale-105 ${className}`}
      style={{ width: `${numSize}px`, height: `${numSize}px` }}
    >
      <path
        d="M 136.0 2.0 L 403.0 2.0 L 383.0 10.0 L 376.0 17.0 L 365.0 50.0 L 355.0 68.0 L 347.0 75.0 L 331.0 80.0 L 68.0 80.0 L 69.0 72.0 L 80.0 40.0 L 89.0 24.0 L 100.0 14.0 L 111.0 8.0 L 135.0 3.0 Z"
        fill={fillWing}
      />
      <path
        d="M 100.0 150.0 L 327.0 150.0 L 316.0 191.0 L 304.0 213.0 L 293.0 222.0 L 273.0 229.0 L 29.0 229.0 L 36.0 196.0 L 40.0 185.0 L 48.0 172.0 L 56.0 164.0 L 66.0 158.0 L 85.0 152.0 L 99.0 151.0 Z"
        fill={fillWing}
      />
      <path
        d="M 67.0 299.0 L 275.0 299.0 L 273.0 311.0 L 264.0 339.0 L 254.0 356.0 L 240.0 368.0 L 229.0 373.0 L 213.0 377.0 L 15.0 377.0 L 5.0 372.0 L 1.0 362.0 L 3.0 346.0 L 12.0 324.0 L 23.0 312.0 L 34.0 306.0 L 51.0 301.0 L 66.0 300.0 Z"
        fill={fillWing}
      />
    </svg>
  );
}
