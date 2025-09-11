import { exec } from "child_process";
import { readFile, unlink } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

import { logger } from "./logger.js";

const execAsync = promisify(exec);

/**
 * Check if clipboard contains an image
 * @returns Promise<boolean> - true if clipboard contains an image
 */
export async function checkClipboardForImage(): Promise<boolean> {
  try {
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

/**
 * Get image from clipboard as a Buffer
 * @returns Promise<Buffer | null> - Image buffer if available, null otherwise
 */
export async function getClipboardImage(): Promise<Buffer | null> {
  try {
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
    const imageBuffer = await readFile(tempImagePath);

    // Clean up the temporary file
    await unlink(tempImagePath).catch(() => {
      // Ignore cleanup errors
    });

    return imageBuffer;
  } catch (error) {
    logger.debug("Error reading image from clipboard:", error);
    return null;
  }
}
