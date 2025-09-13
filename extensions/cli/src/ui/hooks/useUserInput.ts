import type { PermissionMode } from "../../permissions/types.js";
import {
  checkClipboardForImage,
  getClipboardImage,
} from "../../util/clipboard.js";
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

  // Handle Ctrl+C with two-stage exit, Ctrl+D immediately exits
  if (key.ctrl && input === "c") {
    // Clear input box if clearInput function is provided
    if (clearInput) {
      clearInput();
    }
    // Let the main process SIGINT handler handle Ctrl+C logic
    process.kill(process.pid, "SIGINT");
    return true;
  }

  // Handle Ctrl+V for clipboard paste (including images)
  // Note: Cmd+V often doesn't work for image pasting as terminals don't send the key event
  if (key.ctrl && input === "v" && textBuffer) {
    logger.debug("Handling Ctrl+V clipboard paste");

    // Check clipboard for images immediately on paste event
    checkClipboardForImage()
      .then(async (hasImage) => {
        if (hasImage) {
          logger.debug("Image found in clipboard during paste event");
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
        // If no image, let normal text paste handling continue
      })
      .catch((error) => {
        logger.debug("Error checking clipboard for image:", error);
      });

    // Don't consume the event - let normal text paste handling continue
    return false;
  }

  // Handle Ctrl+D to exit
  if (key.ctrl && input === "d") {
    exit();
    import("../../util/exit.js").then(({ gracefulExit }) => gracefulExit(0));
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
  updateBashModeState: (text: string) => void;
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
    updateBashModeState,
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
    updateBashModeState(newText);
    inputHistory.resetNavigation();
  }
}
