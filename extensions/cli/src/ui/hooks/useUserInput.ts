import type { PermissionMode } from "../../permissions/types.js";
import { logger } from "../../util/logger.js";
import type { TextBuffer } from "../TextBuffer.js";

// Helper function to handle control keys
interface ControlKeysOptions {
  input: string;
  key: any;
  exit: () => void;
  showSlashCommands: boolean;
  showFileSearch: boolean;
  cycleModes: () => Promise<PermissionMode>;
  clearInput?: () => void;
  textBuffer?: TextBuffer;
  onTextBufferUpdate?: () => void;
}

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

export function handleControlKeys(options: ControlKeysOptions): boolean {
  const {
    input,
    key,
    exit,
    showSlashCommands,
    showFileSearch,
    cycleModes,
    clearInput,
    textBuffer,
    onTextBufferUpdate,
  } = options;

  // Handle Ctrl+C to clear input
  if (key.ctrl && input === "c" && clearInput) {
    clearInput();
    return true;
  }

  // Handle Ctrl+V for clipboard paste (including images)
  if (key.ctrl && input === "v" && textBuffer) {
    logger.debug("Handling clipboard paste");
    // Check for images asynchronously
    checkClipboardForImage()
      .then(async (hasImage) => {
        if (hasImage) {
          const imageBuffer = await getClipboardImage();
          if (imageBuffer) {
            textBuffer.addImage(imageBuffer);
            // Trigger UI update
            if (onTextBufferUpdate) {
              onTextBufferUpdate();
            }
            return;
          }
        }
        // If no image or image reading failed, let normal text paste handling continue
        // We return false here to allow the normal paste processing to happen
      })
      .catch((error) => {
        logger.debug("Error checking clipboard for image:", error);
        // Continue with normal text paste handling
      });

    // Don't consume the event - let normal paste handling continue
    // This allows text pastes to work normally when no image is present
    return false;
  }

  // Handle Ctrl+D to exit
  if (key.ctrl && input === "d") {
    exit();
    return true;
  }

  // Handle Ctrl+L to refresh screen (clear terminal artifacts)
  if (key.ctrl && input === "l") {
    process.stdout.write("\x1b[2J\x1b[H");
    return true;
  }

  // Handle Shift+Tab to cycle through modes
  if (key.tab && key.shift && !showSlashCommands && !showFileSearch) {
    cycleModes().catch((error) => {
      logger.error("Failed to cycle modes:", error);
    });
    return true;
  }

  return false;
}

// Helper to update text buffer state
interface TextBufferStateOptions {
  handled: boolean;
  textBuffer: any;
  setInputText: (text: string) => void;
  setCursorPosition: (pos: number) => void;
  updateSlashCommandState: (text: string, cursor: number) => void;
  updateFileSearchState: (text: string, cursor: number) => void;
  inputHistory: any;
}

export function updateTextBufferState(options: TextBufferStateOptions) {
  const {
    handled: _handled,
    textBuffer,
    setInputText,
    setCursorPosition,
    updateSlashCommandState,
    updateFileSearchState,
    inputHistory,
  } = options;

  // Skip state updates during rapid input mode to avoid conflicts with timer-based updates
  if (!textBuffer.isInRapidInputMode()) {
    const newText = textBuffer.text;
    const newCursor = textBuffer.cursor;
    setInputText(newText);
    setCursorPosition(newCursor);
    updateSlashCommandState(newText, newCursor);
    updateFileSearchState(newText, newCursor);
    inputHistory.resetNavigation();
  }
}
