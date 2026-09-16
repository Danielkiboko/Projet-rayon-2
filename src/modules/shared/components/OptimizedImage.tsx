// src/components/OptimizedImage.tsx
import Image, { ImageProps } from "next/image";
import React from "react";

type OptimizedImageProps = Omit<ImageProps, "src" | "placeholder" | "blurDataURL"> & {
  src: string;
  alt: string;
  // optional low‑quality placeholder generation function
  generateBlur?: (src: string) => string;
};

/**
 * OptimizedImage wraps Next.js <Image> safely:
 * - If src is a data URI (base64 WebP), it loads directly with unoptimized to eliminate CPU/decoding overhead.
 * - If src is a CDN image (like Unsplash), it enables blur placeholders for progressive loading.
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  generateBlur,
  ...rest
}) => {
  const isDataUrl = src.startsWith("data:");
  
  if (isDataUrl) {
    return (
      <Image
        src={src}
        alt={alt}
        unoptimized
        decoding="async"
        {...rest}
      />
    );
  }

  const isUnsplash = src.includes("unsplash.com");
  const blurUrl = generateBlur
    ? generateBlur(src)
    : isUnsplash
    ? (src.includes("?") ? `${src}&q=10` : `${src}?q=10`)
    : undefined;

  return (
    <Image
      src={src}
      alt={alt}
      placeholder={blurUrl ? "blur" : "empty"}
      blurDataURL={blurUrl}
      decoding="async"
      {...rest}
    />
  );
};
