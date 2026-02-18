import { logger } from "../../util/logger.js";

/**
 * Dynamically import Sharp without using eval
 */
async function loadSharp(): Promise<any> {
  try {
    // Use Function constructor to avoid bundler issues with dynamic imports
    const importSharp = new Function('return import("sharp")');
    const sharpModule = await importSharp().catch(() => null);
    return sharpModule ? sharpModule.default || sharpModule : null;
  } catch {
    return null;
  }
}

/**
 * Process image buffer to JPEG with resizing using Sharp (if available)
 */
async function processImageWithSharp(
  imageBuffer: Buffer,
  maxWidth = 1024,
  maxHeight = 1024,
): Promise<{ buffer: Buffer; isJpeg: boolean }> {
  try {
    // Try to load Sharp - it's an optional dependency
    const sharp = await loadSharp();
    if (!sharp) {
      logger.debug("Sharp not available, using original image buffer");
      return { buffer: imageBuffer, isJpeg: false };
    }

    logger.debug("Processing image with Sharp...");

    // Process image: convert to JPEG and resize if needed
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
 * Detect image format from buffer header - simplified to reduce complexity
 */
function detectImageFormat(buffer: Buffer): string {
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

  return "image/png"; // Default fallback
}

/**
 * Process a single image placeholder - extracted to reduce nesting depth
 */
export async function processImagePlaceholder(
  placeholder: string,
  originalImageBuffer: Buffer,
  textContent: string,
  messageParts: import("core/index.js").MessagePart[],
): Promise<{ textContent: string }> {
  logger.debug(
    `Processing image placeholder: ${placeholder}, original size: ${originalImageBuffer.length} bytes`,
  );

  try {
    // Process image with Sharp (convert to JPEG and resize)
    const processResult = await processImageWithSharp(originalImageBuffer);
    const processedImageBuffer = processResult.buffer;
    const isProcessedJpeg = processResult.isJpeg;

    // Check processed image size
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (processedImageBuffer.length > maxSize) {
      logger.warn(
        `Processed image is still too large (${Math.round(processedImageBuffer.length / 1024 / 1024)}MB). Skipping image.`,
      );
      return {
        textContent: textContent.replace(
          placeholder,
          "[Large image skipped - reduce image size and try again]",
        ),
      };
    }

    // Convert processed buffer to base64 data URL asynchronously to avoid blocking
    logger.debug("Converting processed image to base64...");
    const base64Image = await new Promise<string>((resolve) => {
      // Use setImmediate to yield to event loop
      setImmediate(() => {
        const result = processedImageBuffer.toString("base64");
        resolve(result);
      });
    });

    // Use correct MIME type based on whether Sharp processing was successful
    const mimeType = isProcessedJpeg
      ? "image/jpeg"
      : detectImageFormat(processedImageBuffer);
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    logger.debug(
      `Image converted to base64 with MIME type ${mimeType}, dataUrl length: ${dataUrl.length}`,
    );

    // Split text around the placeholder
    const parts = textContent.split(placeholder);
    if (parts.length > 1) {
      // Add text before placeholder
      if (parts[0]) {
        messageParts.push({
          type: "text",
          text: parts[0],
        });
      }

      // Add image part
      messageParts.push({
        type: "imageUrl",
        imageUrl: { url: dataUrl },
      });

      // Continue with remaining text
      return { textContent: parts.slice(1).join(placeholder) };
    }

    return { textContent };
  } catch (error) {
    logger.error(`Failed to process image ${placeholder}:`, error);
    return {
      textContent: textContent.replace(
        placeholder,
        "[Image processing failed]",
      ),
    };
  }
}
