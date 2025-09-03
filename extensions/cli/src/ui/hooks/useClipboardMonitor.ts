import { useEffect, useRef } from "react";

import {
  checkClipboardForImage,
  getClipboardImage,
} from "../../util/clipboard.js";
import { logger } from "../../util/logger.js";

interface UseClipboardMonitorOptions {
  onImageStatusChange?: (hasImage: boolean) => void;
  enabled?: boolean;
  pollInterval?: number;
}

/**
 * Hook to monitor clipboard for images and notify when status changes
 * Shows helpful UI messages when images are available for pasting
 */
export function useClipboardMonitor({
  onImageStatusChange,
  enabled = true,
  pollInterval = 1000, // Check every second
}: UseClipboardMonitorOptions) {
  const lastImageStatus = useRef<boolean>(false);
  const isChecking = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const checkClipboard = async () => {
      // Prevent overlapping checks
      if (isChecking.current) {
        return;
      }

      isChecking.current = true;

      try {
        const hasImage = await checkClipboardForImage();

        // Only notify if status changed
        if (hasImage !== lastImageStatus.current) {
          lastImageStatus.current = hasImage;
          if (onImageStatusChange) {
            onImageStatusChange(hasImage);
          }
          logger.debug(
            hasImage ? "Image detected in clipboard" : "No image in clipboard",
          );
        }
      } catch (error) {
        logger.debug("Error checking clipboard:", error);
      } finally {
        isChecking.current = false;
      }
    };

    // Start monitoring
    const intervalId: NodeJS.Timeout = setInterval(
      checkClipboard,
      pollInterval,
    );

    // Initial check
    checkClipboard();

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, onImageStatusChange, pollInterval]);

  // Manual check function for explicit paste operations
  const checkNow = async (): Promise<Buffer | null> => {
    if (!enabled || isChecking.current) {
      return null;
    }

    isChecking.current = true;

    try {
      const hasImage = await checkClipboardForImage();

      if (hasImage) {
        const imageBuffer = await getClipboardImage();
        return imageBuffer;
      }
    } catch (error) {
      logger.debug("Error in manual clipboard check:", error);
    } finally {
      isChecking.current = false;
    }

    return null;
  };

  return { checkNow };
}
