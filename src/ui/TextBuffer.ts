import { Key } from "ink";

export class TextBuffer {
  private _text: string = "";
  private _cursor: number = 0;

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
    this._text =
      this._text.slice(0, this._cursor) + text + this._text.slice(this._cursor);
    this._cursor += text.length;
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
    direction: "left" | "right"
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
  }

  handleInput(input: string, key: Key): boolean {
    // Detect option key combinations through escape sequences
    const isOptionKey = input.startsWith("\u001b") && input.length > 1;

    // Handle option key combinations (detected through escape sequences)
    if (isOptionKey) {
      const sequence = input.slice(1);

      // Option + left arrow (usually \u001b[1;9D or \u001bb)
      if (sequence === "b" || sequence.includes("1;9D")) {
        this.moveWordLeft();
        return true;
      }

      // Option + right arrow (usually \u001b[1;9C or \u001bf)
      if (sequence === "f" || sequence.includes("1;9C")) {
        this.moveWordRight();
        return true;
      }

      // Option + backspace (usually \u001b\u0008 or \u001b\u007f)
      if (sequence === "\u0008" || sequence === "\u007f") {
        this.deleteWordBackward();
        return true;
      }

      return true; // Consume other option sequences
    }

    // Handle special key combinations based on input character
    if (key.ctrl) {
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
      }
    }

    // Handle meta key combinations (cmd on Mac)
    if (key.meta) {
      if (key.backspace) {
        this.deleteWordBackward();
        return true;
      }
      if (key.delete) {
        this.deleteWordForward();
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
    }

    // Handle arrow keys
    if (key.leftArrow && !key.meta) {
      this.moveLeft();
      return true;
    }
    if (key.rightArrow && !key.meta) {
      this.moveRight();
      return true;
    }

    // Handle backspace/delete
    if (key.backspace && !key.meta) {
      this.deleteBackward();
      return true;
    }
    if (key.delete && !key.meta) {
      this.deleteForward();
      return true;
    }

    // Handle regular character input
    if (input && input.length === 1 && !key.ctrl && !key.meta && !isOptionKey) {
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
