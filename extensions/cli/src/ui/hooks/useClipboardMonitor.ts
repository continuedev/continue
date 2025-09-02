import { useEffect, useRef } from "react";

import { logger } from "../../util/logger.js";

// Helper function to check if clipboard contains an image
async function checkClipboardForImage(): Promise<boolean> {
  try {
    const os = await import("os");
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const platform = os.platform();

    if (platform === "darwin") {
      // macOS: Check clipboard using osascript
      const { stdout } = await execAsync('osascript -e "clipboard info"');
      return (
        stdout.includes("«class PNGf»") ||
        stdout.includes("«class TIFF»") ||
        stdout.includes("picture")
      );
    } else if (platform === "win32") {
      // Windows: Use PowerShell to check clipboard
      const { stdout } = await execAsync(
        'powershell -command "Get-Clipboard -Format Image | Measure-Object | Select-Object -ExpandProperty Count"',
      );
      return parseInt(stdout.trim()) > 0;
    } else if (platform === "linux") {
      // Linux: Check if xclip can get image data
      try {
        await execAsync(
          "xclip -selection clipboard -t image/png -o > /dev/null 2>&1",
        );
        return true;
      } catch {
        return false;
      }
    }

    return false;
  } catch (error) {
    logger.debug("Error checking clipboard for image:", error);
    return false;
  }
}

// Helper function to get image from clipboard
async function getClipboardImage(): Promise<Buffer | null> {
  try {
    const os = await import("os");
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    const fs = await import("fs/promises");
    const path = await import("path");

    const platform = os.platform();
    const tempDir = os.tmpdir();
    const tempImagePath = path.join(
      tempDir,
      `continue-clipboard-${Date.now()}.png`,
    );

    if (platform === "darwin") {
      // macOS: Save clipboard image using osascript
      await execAsync(
        `osascript -e 'set the clipboard to (the clipboard as «class PNGf»)' -e 'set png_data to (the clipboard as «class PNGf»)' -e 'set file_ref to open for access "${tempImagePath}" with write permission' -e 'write png_data to file_ref' -e 'close access file_ref'`,
      );
    } else if (platform === "win32") {
      // Windows: Use PowerShell to save clipboard image
      await execAsync(
        `powershell -command "$image = Get-Clipboard -Format Image; if ($image) { $image.Save('${tempImagePath}') }"`,
      );
    } else if (platform === "linux") {
      // Linux: Use xclip to save clipboard image
      await execAsync(
        `xclip -selection clipboard -t image/png -o > "${tempImagePath}"`,
      );
    } else {
      return null;
    }

    // Read the temporary file
    const imageBuffer = await fs.readFile(tempImagePath);

    // Clean up the temporary file
    await fs.unlink(tempImagePath).catch(() => {
      // Ignore cleanup errors
    });

    return imageBuffer;
  } catch (error) {
    logger.debug("Error reading image from clipboard:", error);
    return null;
  }
}

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
