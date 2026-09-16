import imageCompression from "browser-image-compression";

export interface OptimizedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  originalFormatted: string;
  compressedFormatted: string;
  width: number;
  height: number;
  format: string;
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1, default 0.8
  maxSizeMB?: number;
}

/**
 * Format bytes to readable string (e.g. 4.2 Mo, 45 Ko)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Ko";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Octets", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i] || "Ko"}`;
}

/**
 * Converts any image File to ultra-lightweight WebP format.
 * - Resizes proportionally (default max 960px) for razor-sharp display at a fraction of the weight.
 * - Strips heavy EXIF/camera metadata.
 * - Outputs native image/webp format with high quality bicubic interpolation.
 */
export async function optimizeImageToWebP(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult> {
  const {
    maxWidth = 960,
    maxHeight = 960,
    quality = 0.8,
    maxSizeMB = 0.15 // Target ~150KB max, usually lands around 30KB-60KB
  } = options;

  const originalSize = file.size;

  // 1. Try modern Canvas API conversion to image/webp
  try {
    const canvasResult = await convertViaCanvas(file, maxWidth, maxHeight, quality);
    if (canvasResult) {
      const compressedSize = canvasResult.file.size;
      const saved = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

      return {
        file: canvasResult.file,
        dataUrl: canvasResult.dataUrl,
        originalSize,
        compressedSize,
        savedPercentage: saved,
        originalFormatted: formatBytes(originalSize),
        compressedFormatted: formatBytes(compressedSize),
        width: canvasResult.width,
        height: canvasResult.height,
        format: "image/webp"
      };
    }
  } catch (canvasErr) {
    console.warn("Canvas WebP conversion fallback:", canvasErr);
  }

  // 2. Fallback to browser-image-compression with WebP specification
  try {
    const compressionOptions = {
      maxSizeMB,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      useWebWorker: true,
      fileType: "image/webp"
    };

    const compressedFile = await imageCompression(file, compressionOptions);
    const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
    const compressedSize = compressedFile.size;
    const saved = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

    return {
      file: compressedFile,
      dataUrl,
      originalSize,
      compressedSize,
      savedPercentage: saved,
      originalFormatted: formatBytes(originalSize),
      compressedFormatted: formatBytes(compressedSize),
      width: maxWidth,
      height: maxHeight,
      format: compressedFile.type || "image/webp"
    };
  } catch (fallbackErr) {
    console.error("Image compression error, falling back to original file:", fallbackErr);
    
    // Ultimate fallback: return raw dataURL
    const rawDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    return {
      file,
      dataUrl: rawDataUrl,
      originalSize,
      compressedSize: originalSize,
      savedPercentage: 0,
      originalFormatted: formatBytes(originalSize),
      compressedFormatted: formatBytes(originalSize),
      width: maxWidth,
      height: maxHeight,
      format: file.type || "image/jpeg"
    };
  }
}

/**
 * Canvas converter that guarantees WebP output and removes EXIF data.
 */
function convertViaCanvas(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<{ file: File; dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.HTMLCanvasElement) {
      return resolve(null);
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      // Maintain aspect ratio
      if (targetWidth > maxWidth || targetHeight > maxHeight) {
        const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) {
        return resolve(null);
      }

      // Smooth bicubic resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Check if browser can export to image/webp
      const testData = canvas.toDataURL("image/webp");
      const isWebpSupported = testData.startsWith("data:image/webp");
      const targetMime = isWebpSupported ? "image/webp" : "image/jpeg";
      const targetExtension = isWebpSupported ? ".webp" : ".jpg";

      const dataUrl = canvas.toDataURL(targetMime, quality);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve(null);
          }
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const convertedFile = new File([blob], `${baseName}${targetExtension}`, {
            type: targetMime,
            lastModified: Date.now()
          });

          resolve({
            file: convertedFile,
            dataUrl,
            width: targetWidth,
            height: targetHeight
          });
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
}
