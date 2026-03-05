import {
  detectImageFormat,
  processImageWithSharp,
} from "../../util/image.js";
import { logger } from "../../util/logger.js";

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
