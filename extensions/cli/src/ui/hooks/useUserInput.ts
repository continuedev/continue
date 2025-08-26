import type { PermissionMode } from "../../permissions/types.js";
import { logger } from "../../util/logger.js";

// Helper function to handle control keys
interface ControlKeysOptions {
  input: string;
  key: any;
  exit: () => void;
  showSlashCommands: boolean;
  showFileSearch: boolean;
  cycleModes: () => Promise<PermissionMode>;
  clearInput?: () => void;
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
  } = options;

  // Handle Ctrl+C to clear input
  if (key.ctrl && input === "c" && clearInput) {
    clearInput();
    return true;
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
    handled,
    textBuffer,
    setInputText,
    setCursorPosition,
    updateSlashCommandState,
    updateFileSearchState,
    inputHistory,
  } = options;

  // Skip state updates during rapid input mode to avoid conflicts with timer-based updates
  if (handled && !textBuffer.isInRapidInputMode()) {
    const newText = textBuffer.text;
    const newCursor = textBuffer.cursor;
    setInputText(newText);
    setCursorPosition(newCursor);
    updateSlashCommandState(newText, newCursor);
    updateFileSearchState(newText, newCursor);
    inputHistory.resetNavigation();
  }
}
