import * as path from "path";

import { logger } from "./logger.js";

/**
 * Image file extensions supported for visual reading.
 * SVG is excluded because it's text-based XML that models can reason about directly.
 */
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
]);

/**
 * Check if a file path points to an image file based on extension.
 */
export function isImageFile(filepath: string): boolean {
  const ext = path.extname(filepath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Dynamically import Sharp without using eval.
 * Sharp is an optional dependency for image processing.
 */
async function loadSharp(): Promise<any> {
  try {
    const importSharp = new Function('return import("sharp")');
    const sharpModule = await importSharp().catch(() => null);
    return sharpModule ? sharpModule.default || sharpModule : null;
  } catch {
    return null;
  }
}

/**
 * Process image buffer to JPEG with resizing using Sharp (if available).
 * Falls back to the original buffer if Sharp is not installed.
 */
export async function processImageWithSharp(
  imageBuffer: Buffer,
  maxWidth = 1024,
  maxHeight = 1024,
): Promise<{ buffer: Buffer; isJpeg: boolean }> {
  try {
    const sharp = await loadSharp();
    if (!sharp) {
      logger.debug("Sharp not available, using original image buffer");
      return { buffer: imageBuffer, isJpeg: false };
    }

    logger.debug("Processing image with Sharp...");

    const processedBuffer = await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    logger.debug(
      `Image processed with Sharp: ${imageBuffer.length} bytes -> ${processedBuffer.length} bytes`,
    );
    return { buffer: processedBuffer, isJpeg: true };
  } catch (error) {
    logger.warn("Failed to process image with Sharp, using original:", error);
    return { buffer: imageBuffer, isJpeg: false };
  }
}

/**
 * Detect image MIME type from buffer header bytes.
 */
export function detectImageFormat(buffer: Buffer): string {
  if (buffer.length < 4) return "image/png";

  const signature = buffer.subarray(0, 4);

  // JPEG: FF D8 FF
  if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47
  ) {
    return "image/png";
  }

  // GIF: 47 49 46 38
  if (
    signature[0] === 0x47 &&
    signature[1] === 0x49 &&
    signature[2] === 0x46 &&
    signature[3] === 0x38
  ) {
    return "image/gif";
  }

  // WebP: RIFF + WEBP at offset 8
  if (signature[0] === 0x52 && signature[1] === 0x49 && buffer.length >= 12) {
    const webpSig = buffer.subarray(8, 12);
    if (
      webpSig[0] === 0x57 &&
      webpSig[1] === 0x45 &&
      webpSig[2] === 0x42 &&
      webpSig[3] === 0x50
    ) {
      return "image/webp";
    }
  }

  // BMP: 42 4D
  if (signature[0] === 0x42 && signature[1] === 0x4d) {
    return "image/bmp";
  }

  return "image/png"; // Default fallback
}

/**
 * Format a byte count into a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
