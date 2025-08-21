import { Key } from "ink";

export const COLLAPSE_SIZE = 800; // Characters threshold for collapsing pasted content
export const RAPID_INPUT_THRESHOLD = 200; // Minimum characters to trigger rapid input detection

export class TextBuffer {
  private _text: string = "";
  private _cursor: number = 0;
  private _pasteBuffer: string = "";
  private _inPasteMode: boolean = false;
  private _rapidInputBuffer: string = "";
  private _rapidInputStartPos: number = 0;
  private _lastInputTime: number = 0;
  private _rapidInputTimer: NodeJS.Timeout | null = null;
  private _onStateChange?: () => void;
  private _pasteMap = new Map<string, string>(); // placeholder -> original content
  private _pasteCounter: number = 0;

  constructor(initialText: string = "") {
    this._text = initialText;
    this._cursor = initialText.length;
  }

  get text(): string {
    return this._text;
  }

  get cursor(): number {
    return this._cursor;
  }

  setText(text: string): void {
    this._text = text;
    this._cursor = Math.min(this._cursor, text.length);
  }

  setCursor(position: number): void {
    this._cursor = Math.max(0, Math.min(position, this._text.length));
  }

  insertText(text: string): void {
    // Normalize line endings to prevent terminal display issues
    const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    this._text =
      this._text.slice(0, this._cursor) +
      normalizedText +
      this._text.slice(this._cursor);
    this._cursor += normalizedText.length;
  }

  deleteCharAt(position: number): void {
    if (position >= 0 && position < this._text.length) {
      this._text =
        this._text.slice(0, position) + this._text.slice(position + 1);
      if (this._cursor > position) {
        this._cursor--;
      }
    }
  }

  deleteBackward(): void {
    if (this._cursor > 0) {
      this.deleteCharAt(this._cursor - 1);
    }
  }

  deleteForward(): void {
    if (this._cursor < this._text.length) {
      this.deleteCharAt(this._cursor);
    }
  }

  private findWordBoundary(
    position: number,
    direction: "left" | "right",
  ): number {
    if (direction === "left") {
      // Find start of current word or previous word
      let pos = Math.max(0, position - 1);

      // Skip whitespace
      while (pos > 0 && /\s/.test(this._text[pos])) {
        pos--;
      }

      // Find word boundary
      while (pos > 0 && !/\s/.test(this._text[pos - 1])) {
        pos--;
      }

      return pos;
    } else {
      // Find end of current word or next word
      let pos = position;

      // Skip whitespace
      while (pos < this._text.length && /\s/.test(this._text[pos])) {
        pos++;
      }

      // Find word boundary
      while (pos < this._text.length && !/\s/.test(this._text[pos])) {
        pos++;
      }

      return pos;
    }
  }

  moveWordLeft(): void {
    this._cursor = this.findWordBoundary(this._cursor, "left");
  }

  moveWordRight(): void {
    this._cursor = this.findWordBoundary(this._cursor, "right");
  }

  deleteWordBackward(): void {
    const wordStart = this.findWordBoundary(this._cursor, "left");
    if (wordStart < this._cursor) {
      this._text =
        this._text.slice(0, wordStart) + this._text.slice(this._cursor);
      this._cursor = wordStart;
    }
  }

  deleteWordForward(): void {
    const wordEnd = this.findWordBoundary(this._cursor, "right");
    if (wordEnd > this._cursor) {
      this._text =
        this._text.slice(0, this._cursor) + this._text.slice(wordEnd);
    }
  }

  moveToStart(): void {
    this._cursor = 0;
  }

  moveToEnd(): void {
    this._cursor = this._text.length;
  }

  moveLeft(): void {
    this._cursor = Math.max(0, this._cursor - 1);
  }

  moveRight(): void {
    this._cursor = Math.min(this._text.length, this._cursor + 1);
  }

  clear(): void {
    this._text = "";
    this._cursor = 0;
    this._pasteMap.clear();
    this._pasteCounter = 0;
    this._pasteBuffer = "";
    this._inPasteMode = false;
    this._rapidInputBuffer = "";
    this._rapidInputStartPos = 0;
    this._lastInputTime = 0;
    if (this._rapidInputTimer) {
      clearTimeout(this._rapidInputTimer);
      this._rapidInputTimer = null;
    }
  }

  isInPasteMode(): boolean {
    return this._inPasteMode;
  }

  isInRapidInputMode(): boolean {
    return this._rapidInputBuffer.length > 0;
  }

  setStateChangeCallback(callback: () => void): void {
    this._onStateChange = callback;
  }

  // Called on Enter to expand full pasted content before submission
  expandAllPasteBlocks(): void {
    for (const [placeholder, originalContent] of this._pasteMap.entries()) {
      const regex = new RegExp(this.escapeRegex(placeholder), "g");
      // Normalize line endings to prevent terminal display issues
      const normalizedContent = originalContent
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
      this._text = this._text.replace(regex, normalizedContent);
    }
    this._pasteMap.clear();
  }

  // Test helper: forces immediate finalization without waiting for timers
  flushPendingInput(): void {
    if (this._rapidInputTimer) {
      clearTimeout(this._rapidInputTimer);
      this._rapidInputTimer = null;
      this.finalizeRapidInput();
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Creates placeholder for single line or multi-line pastes
  private createPlaceholder(originalText: string): string {
    this._pasteCounter++;
    const lineCount = originalText.split(/\r\n|\r|\n/).length;

    if (lineCount === 1) {
      return `[Paste #${this._pasteCounter}]`;
    } else {
      return `[Paste #${this._pasteCounter}, ${lineCount} lines]`;
    }
  }

  // Handles bracketed paste: \e[200~ (start) and \e[201~ (end) sequences
  private handleBracketedPaste(input: string): boolean {
    // Modern terminals wrap pasted content in escape sequences
    if (input === "\u001b[200~") {
      // Clear any pending rapid input timer to avoid conflicts
      if (this._rapidInputTimer) {
        clearTimeout(this._rapidInputTimer);
        this._rapidInputTimer = null;
      }
      this._inPasteMode = true;
      this._pasteBuffer = "";
      return true;
    }

    if (input === "\u001b[201~") {
      this._inPasteMode = false;

      if (this._pasteBuffer.length > COLLAPSE_SIZE) {
        const placeholder = this.createPlaceholder(this._pasteBuffer);
        this._pasteMap.set(placeholder, this._pasteBuffer);
        this.insertText(placeholder);
      } else {
        this.insertText(this._pasteBuffer);
      }

      this._pasteBuffer = "";
      return true;
    }

    return false;
  }

  // Fallback paste detection: detects rapid chunks by timing and size RAPID_INPUT_THRESHOLD
  private handleRapidInput(input: string): boolean {
    const now = Date.now();
    const timeSinceLastInput = now - this._lastInputTime;

    // If we're already in rapid input mode and this comes quickly, add to buffer
    if (this._rapidInputBuffer.length > 0 && timeSinceLastInput < 100) {
      this._rapidInputBuffer += input;
      this._lastInputTime = now;

      if (this._rapidInputTimer) {
        clearTimeout(this._rapidInputTimer);
      }

      // Reset timer: 200ms pause indicates end of paste
      this._rapidInputTimer = setTimeout(() => {
        this.finalizeRapidInput();
      }, 200);

      return true;
    }

    // Fallback paste detection: some terminals send large pastes as rapid chunks
    // instead of using bracketed paste mode. We detect this by timing between inputs.
    if (
      input.length > RAPID_INPUT_THRESHOLD ||
      (input.length >= 50 && this._rapidInputBuffer.length === 0)
    ) {
      this._rapidInputStartPos = this._cursor;

      // Accumulate chunks without inserting to avoid visual flicker
      this._rapidInputBuffer = input;
      this._lastInputTime = now;

      if (this._rapidInputTimer) {
        clearTimeout(this._rapidInputTimer);
      }

      // 200ms pause indicates end of paste
      this._rapidInputTimer = setTimeout(() => {
        this.finalizeRapidInput();
      }, 200);

      return true; // Consume input without inserting until finalized
    }

    this._lastInputTime = now;
    return false;
  }

  // Called after rapid input timer expires to collapse or insert buffered content
  private finalizeRapidInput(): void {
    if (this._rapidInputBuffer.length > COLLAPSE_SIZE) {
      const placeholder = this.createPlaceholder(this._rapidInputBuffer);
      this._pasteMap.set(placeholder, this._rapidInputBuffer);

      this._text =
        this._text.slice(0, this._rapidInputStartPos) +
        placeholder +
        this._text.slice(this._rapidInputStartPos);
      this._cursor = this._rapidInputStartPos + placeholder.length;

      if (this._onStateChange) {
        this._onStateChange();
      }
    } else {
      this.insertText(this._rapidInputBuffer);

      if (this._onStateChange) {
        this._onStateChange();
      }
    }

    this._rapidInputBuffer = "";
    this._rapidInputStartPos = 0;
    this._rapidInputTimer = null;
  }

  private handleOptionKey(sequence: string): boolean {
    // Option + backspace (usually \u001b\u0008 or \u001b\u007f)
    if (sequence === "\u0008" || sequence === "\u007f") {
      this.deleteWordBackward();
      return true;
    }
    return true; // Consume other option sequences
  }

  private handleCtrlKey(input: string): boolean {
    switch (input) {
      case "a":
        this.moveToStart();
        return true;
      case "e":
        this.moveToEnd();
        return true;
      case "u":
        // Delete from cursor to start of line
        this._text = this._text.slice(this._cursor);
        this._cursor = 0;
        return true;
      case "k":
        // Delete from cursor to end of line
        this._text = this._text.slice(0, this._cursor);
        return true;
      case "w":
        this.deleteWordBackward();
        return true;
      case "d":
        this.deleteWordForward();
        return true;
      default:
        return false;
    }
  }

  private handleMetaKey(input: string, key: Key): boolean {
    if (key.backspace || key.delete) {
      this.deleteWordBackward();
      return true;
    }
    if (key.leftArrow) {
      this.moveWordLeft();
      return true;
    }
    if (key.rightArrow) {
      this.moveWordRight();
      return true;
    }
    // Handle option+left/right as characters (on Mac, option+arrow sends character codes)
    if (input === "b") {
      this.moveWordLeft();
      return true;
    }
    if (input === "f") {
      this.moveWordRight();
      return true;
    }
    return false;
  }

  private handleArrowKeys(key: Key): boolean {
    if (key.leftArrow && !key.meta) {
      this.moveLeft();
      return true;
    }
    if (key.rightArrow && !key.meta) {
      this.moveRight();
      return true;
    }
    return false;
  }

  private handleDeleteKeys(key: Key): boolean {
    // On Mac, backspace key registers as key.delete, so treat it as backward deletion
    if ((key.delete || key.backspace) && !key.meta) {
      this.deleteBackward();
      return true;
    }
    return false;
  }

  handleInput(input: string, key: Key): boolean {
    // Handle bracketed paste sequences first
    if (this.handleBracketedPaste(input)) {
      return true;
    }

    // If we're in paste mode, accumulate the pasted content but DON'T insert it yet
    if (this._inPasteMode) {
      this._pasteBuffer += input;
      // Don't insert text during paste mode - wait until paste ends
      return true;
    }

    // Detect option key combinations through escape sequences
    const isOptionKey = input.startsWith("\u001b") && input.length > 1;

    // Handle option key combinations (detected through escape sequences)
    if (isOptionKey) {
      return this.handleOptionKey(input.slice(1));
    }

    // Handle special key combinations based on input character
    if (key.ctrl) {
      const handled = this.handleCtrlKey(input);
      if (handled) return true;
    }

    // Handle meta key combinations (cmd on Mac)
    if (key.meta) {
      const handled = this.handleMetaKey(input, key);
      if (handled) return true;
    }

    // Handle arrow keys
    if (this.handleArrowKeys(key)) {
      return true;
    }

    // Handle backspace/delete
    if (this.handleDeleteKeys(key)) {
      return true;
    }

    if (input && input.length >= 1 && !key.ctrl && !key.meta && !isOptionKey) {
      // Direct paste detection: single large input - but delay insertion to catch split pastes
      if (input.length > COLLAPSE_SIZE && this._rapidInputBuffer.length === 0) {
        // Start rapid input mode immediately to delay placeholder creation
        this._rapidInputStartPos = this._cursor;
        this._rapidInputBuffer = input;
        this._lastInputTime = Date.now();

        if (this._rapidInputTimer) {
          clearTimeout(this._rapidInputTimer);
        }

        // Wait 250ms to see if more content comes (split paste)
        this._rapidInputTimer = setTimeout(() => {
          this.finalizeRapidInput();
        }, 250);

        return true;
      }

      // Fallback: detect chunked paste operations
      if (this.handleRapidInput(input)) {
        return true;
      }

      this.insertText(input);
      return true;
    }

    return false;
  }

  // Helper method to render text with cursor
  renderWithCursor(placeholder?: string): {
    text: string;
    cursorPosition: number;
  } {
    if (this._text.length === 0 && placeholder) {
      return { text: placeholder, cursorPosition: 0 };
    }

    return {
      text: this._text,
      cursorPosition: this._cursor,
    };
  }
}
