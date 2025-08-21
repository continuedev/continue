import {
  TextBuffer,
  COLLAPSE_SIZE,
  RAPID_INPUT_THRESHOLD,
} from "./TextBuffer.js";

describe("TextBuffer", () => {
  let buffer: TextBuffer;

  beforeEach(() => {
    buffer = new TextBuffer();
  });

  describe("constructor", () => {
    it("should initialize with empty text by default", () => {
      expect(buffer.text).toBe("");
      expect(buffer.cursor).toBe(0);
    });

    it("should initialize with provided text", () => {
      const buffer = new TextBuffer("hello");
      expect(buffer.text).toBe("hello");
      expect(buffer.cursor).toBe(5);
    });
  });

  describe("setText", () => {
    it("should set text and maintain cursor position", () => {
      buffer.setText("hello");
      expect(buffer.text).toBe("hello");
      expect(buffer.cursor).toBe(0);
    });

    it("should adjust cursor if it exceeds text length", () => {
      buffer.setText("hello world");
      buffer.setCursor(5);
      buffer.setText("hi");
      expect(buffer.text).toBe("hi");
      expect(buffer.cursor).toBe(2);
    });
  });

  describe("setCursor", () => {
    beforeEach(() => {
      buffer.setText("hello");
    });

    it("should set cursor to valid position", () => {
      buffer.setCursor(3);
      expect(buffer.cursor).toBe(3);
    });

    it("should clamp cursor to minimum of 0", () => {
      buffer.setCursor(-5);
      expect(buffer.cursor).toBe(0);
    });

    it("should clamp cursor to maximum of text length", () => {
      buffer.setCursor(10);
      expect(buffer.cursor).toBe(5);
    });
  });

  describe("insertText", () => {
    it("should insert text at cursor position", () => {
      buffer.setText("hello");
      buffer.setCursor(2);
      buffer.insertText("XX");
      expect(buffer.text).toBe("heXXllo");
      expect(buffer.cursor).toBe(4);
    });

    it("should insert text at beginning", () => {
      buffer.setText("world");
      buffer.setCursor(0);
      buffer.insertText("hello ");
      expect(buffer.text).toBe("hello world");
      expect(buffer.cursor).toBe(6);
    });

    it("should insert text at end", () => {
      buffer.setText("hello");
      buffer.setCursor(5);
      buffer.insertText(" world");
      expect(buffer.text).toBe("hello world");
      expect(buffer.cursor).toBe(11);
    });
  });

  describe("deleteCharAt", () => {
    beforeEach(() => {
      buffer.setText("hello");
      buffer.setCursor(3);
    });

    it("should delete character at specified position", () => {
      buffer.deleteCharAt(2);
      expect(buffer.text).toBe("helo");
      expect(buffer.cursor).toBe(2);
    });

    it("should not adjust cursor if deleting before cursor", () => {
      buffer.deleteCharAt(1);
      expect(buffer.text).toBe("hllo");
      expect(buffer.cursor).toBe(2);
    });

    it("should not delete if position is out of bounds", () => {
      buffer.deleteCharAt(10);
      expect(buffer.text).toBe("hello");
      expect(buffer.cursor).toBe(3);
    });

    it("should not delete if position is negative", () => {
      buffer.deleteCharAt(-1);
      expect(buffer.text).toBe("hello");
      expect(buffer.cursor).toBe(3);
    });
  });

  describe("deleteBackward", () => {
    beforeEach(() => {
      buffer.setText("hello");
      buffer.setCursor(3);
    });

    it("should delete character before cursor", () => {
      buffer.deleteBackward();
      expect(buffer.text).toBe("helo");
      expect(buffer.cursor).toBe(2);
    });

    it("should not delete if cursor is at beginning", () => {
      buffer.setCursor(0);
      buffer.deleteBackward();
      expect(buffer.text).toBe("hello");
      expect(buffer.cursor).toBe(0);
    });
  });

  describe("deleteForward", () => {
    beforeEach(() => {
      buffer.setText("hello");
      buffer.setCursor(2);
    });

    it("should delete character at cursor position", () => {
      buffer.deleteForward();
      expect(buffer.text).toBe("helo");
      expect(buffer.cursor).toBe(2);
    });

    it("should not delete if cursor is at end", () => {
      buffer.setCursor(5);
      buffer.deleteForward();
      expect(buffer.text).toBe("hello");
      expect(buffer.cursor).toBe(5);
    });
  });

  describe("moveWordLeft", () => {
    beforeEach(() => {
      buffer.setText("hello world test");
    });

    it("should move to start of current word", () => {
      buffer.setCursor(8); // middle of "world"
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(6); // start of "world"
    });

    it("should move to start of previous word", () => {
      buffer.setCursor(6); // start of "world"
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(0); // start of "hello"
    });

    it("should skip whitespace", () => {
      buffer.setCursor(11); // space after "world"
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(6); // start of "world"
    });

    it("should not move beyond beginning", () => {
      buffer.setCursor(0);
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(0);
    });
  });

  describe("moveWordRight", () => {
    beforeEach(() => {
      buffer.setText("hello world test");
    });

    it("should move to end of current word", () => {
      buffer.setCursor(2); // middle of "hello"
      buffer.moveWordRight();
      expect(buffer.cursor).toBe(5); // end of "hello"
    });

    it("should skip whitespace to next word", () => {
      buffer.setCursor(5); // end of "hello"
      buffer.moveWordRight();
      expect(buffer.cursor).toBe(11); // end of "world"
    });

    it("should not move beyond end", () => {
      buffer.setCursor(16);
      buffer.moveWordRight();
      expect(buffer.cursor).toBe(16);
    });
  });

  describe("deleteWordBackward", () => {
    beforeEach(() => {
      buffer.setText("hello world test");
    });

    it("should delete from cursor to start of word", () => {
      buffer.setCursor(8); // middle of "world"
      buffer.deleteWordBackward();
      expect(buffer.text).toBe("hello rld test");
      expect(buffer.cursor).toBe(6);
    });

    it("should delete entire previous word", () => {
      buffer.setCursor(6); // start of "world"
      buffer.deleteWordBackward();
      expect(buffer.text).toBe("world test");
      expect(buffer.cursor).toBe(0);
    });
  });

  describe("deleteWordForward", () => {
    beforeEach(() => {
      buffer.setText("hello world test");
    });

    it("should delete from cursor to end of word", () => {
      buffer.setCursor(2); // middle of "hello"
      buffer.deleteWordForward();
      expect(buffer.text).toBe("he world test");
      expect(buffer.cursor).toBe(2);
    });

    it("should delete to next word boundary", () => {
      buffer.setCursor(5); // end of "hello"
      buffer.deleteWordForward();
      expect(buffer.text).toBe("hello test");
      expect(buffer.cursor).toBe(5);
    });
  });

  describe("movement methods", () => {
    beforeEach(() => {
      buffer.setText("hello");
      buffer.setCursor(2);
    });

    it("should move to start", () => {
      buffer.moveToStart();
      expect(buffer.cursor).toBe(0);
    });

    it("should move to end", () => {
      buffer.moveToEnd();
      expect(buffer.cursor).toBe(5);
    });

    it("should move left", () => {
      buffer.moveLeft();
      expect(buffer.cursor).toBe(1);
    });

    it("should not move left beyond start", () => {
      buffer.setCursor(0);
      buffer.moveLeft();
      expect(buffer.cursor).toBe(0);
    });

    it("should move right", () => {
      buffer.moveRight();
      expect(buffer.cursor).toBe(3);
    });

    it("should not move right beyond end", () => {
      buffer.setCursor(5);
      buffer.moveRight();
      expect(buffer.cursor).toBe(5);
    });
  });

  describe("clear", () => {
    it("should clear text and reset cursor", () => {
      buffer.setText("hello world");
      buffer.setCursor(5);
      buffer.clear();
      expect(buffer.text).toBe("");
      expect(buffer.cursor).toBe(0);
    });

    it("should clear paste map when clearing", () => {
      const longText = "a".repeat(COLLAPSE_SIZE + 1);
      buffer.handleInput(longText, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();

      expect(buffer.text).toBe("[Paste #1]");

      buffer.clear();
      expect(buffer.text).toBe("");
      expect(buffer.cursor).toBe(0);
    });
  });

  describe("paste collapse", () => {
    it("should not collapse short pasted text", () => {
      const shortText = "hello world";
      buffer.handleInput(shortText, { ctrl: false, meta: false } as any);

      expect(buffer.text).toBe("hello world");
    });

    it("should collapse long pasted text exceeding collapse threshold", () => {
      const longText = "a".repeat(COLLAPSE_SIZE + 1);
      buffer.handleInput(longText, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();

      expect(buffer.text).toBe("[Paste #1]");
    });

    it("should count lines correctly in collapsed text", () => {
      const multiLineText = "line1\nline2\nline3\n" + "a".repeat(COLLAPSE_SIZE);
      buffer.handleInput(multiLineText, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();

      expect(buffer.text).toBe("[Paste #1, 4 lines]");
    });

    it("should expand collapsed content on expandAllPasteBlocks", () => {
      const longText = "hello " + "a".repeat(COLLAPSE_SIZE);
      buffer.handleInput(longText, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();

      // Verify it was collapsed
      expect(buffer.text).toBe("[Paste #1]");

      // Expand it
      buffer.expandAllPasteBlocks();

      // Verify it was expanded with normalized line endings
      expect(buffer.text).toBe(longText);
    });

    it("should handle typing before and after collapsed content", () => {
      buffer.setText("before ");
      buffer.setCursor(7);

      const longText = "a".repeat(COLLAPSE_SIZE + 1);
      buffer.handleInput(longText, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();

      expect(buffer.text).toBe("before [Paste #1]");

      // Type after collapsed content
      buffer.insertText(" after");
      expect(buffer.text).toBe("before [Paste #1] after");

      // Move cursor to beginning and type
      buffer.setCursor(0);
      buffer.insertText("start ");
      expect(buffer.text).toBe("start before [Paste #1] after");
    });

    it("should handle exactly collapse threshold without collapsing", () => {
      const exactText = "a".repeat(COLLAPSE_SIZE); // exactly at threshold
      buffer.handleInput(exactText, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput(); // This will go into rapid input mode due to size

      expect(buffer.text).toBe(exactText); // Should not be collapsed
    });

    it("should handle paste operations as single large inputs", () => {
      // This simulates the most common paste scenario: a single large input
      const longText = "x".repeat(COLLAPSE_SIZE + 1);

      expect(longText.length).toBeGreaterThan(COLLAPSE_SIZE);

      buffer.handleInput(longText, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();

      // Should be collapsed
      expect(buffer.text).toBe("[Paste #1]");
    });

    it("should handle bracketed paste mode", () => {
      // Simulate bracketed paste: start sequence, content, end sequence

      // Start paste mode
      buffer.handleInput("\u001b[200~", {} as any);
      expect(buffer.isInPasteMode()).toBe(true);

      // Add some content (in chunks like real paste)
      const chunks = [
        "Hello ",
        "world! ",
        "This is a long piece of text. ".repeat(30),
      ];
      const totalContent = chunks.join("");

      chunks.forEach((chunk) => {
        buffer.handleInput(chunk, { ctrl: false, meta: false } as any);
      });

      // Text should NOT be visible during paste mode (to avoid visual bugs)
      expect(buffer.text).toBe("");

      // End paste mode
      buffer.handleInput("\u001b[201~", {} as any);
      expect(buffer.isInPasteMode()).toBe(false);

      // Now should be collapsed if > COLLAPSE_SIZE
      if (totalContent.length > COLLAPSE_SIZE) {
        expect(buffer.text).toBe("[Paste #1]");
      }
    });

    it("should not collapse short bracketed paste content", () => {
      // Start paste mode
      buffer.handleInput("\u001b[200~", {} as any);

      // Add short content
      const shortContent = "Hello world!";
      buffer.handleInput(shortContent, { ctrl: false, meta: false } as any);

      // End paste mode
      buffer.handleInput("\u001b[201~", {} as any);

      // Should not be collapsed
      expect(buffer.text).toBe(shortContent);
    });

    it("should normalize line endings when expanding", () => {
      const textWithCarriageReturns =
        "line1\r\nline2\rline3\n" + "a".repeat(COLLAPSE_SIZE);
      buffer.handleInput(textWithCarriageReturns, {
        ctrl: false,
        meta: false,
      } as any);
      buffer.flushPendingInput();

      expect(buffer.text).toBe("[Paste #1, 4 lines]");

      buffer.expandAllPasteBlocks();

      // Should have normalized line endings
      const expected = "line1\nline2\nline3\n" + "a".repeat(COLLAPSE_SIZE);
      expect(buffer.text).toBe(expected);
    });

    it("should increment paste counter for multiple pastes", () => {
      const longText1 = "a".repeat(COLLAPSE_SIZE + 1);
      const longText2 = "b".repeat(COLLAPSE_SIZE + 1);

      buffer.handleInput(longText1, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();
      expect(buffer.text).toBe("[Paste #1]");

      buffer.insertText(" ");
      buffer.handleInput(longText2, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();
      expect(buffer.text).toBe("[Paste #1] [Paste #2]");
    });

    it("should detect rapid input above threshold", () => {
      // Test that input above RAPID_INPUT_THRESHOLD triggers rapid input detection
      const rapidText = "x".repeat(RAPID_INPUT_THRESHOLD + 1);
      buffer.handleInput(rapidText, { ctrl: false, meta: false } as any);

      // Should go into rapid input buffer (not displayed yet)
      expect(buffer.text).toBe("");
      expect(buffer.isInRapidInputMode()).toBe(true);

      // Flush to finalize
      buffer.flushPendingInput();

      // Now should be displayed (but not collapsed since < COLLAPSE_SIZE)
      expect(buffer.text).toBe(rapidText);
    });

    it("should combine split paste chunks", () => {
      // Simulate macOS Terminal splitting paste
      const firstChunk = "a".repeat(COLLAPSE_SIZE + 200); // Large first chunk
      buffer.handleInput(firstChunk, { ctrl: false, meta: false } as any);

      // First chunk goes into rapid input mode - no placeholder yet
      expect(buffer.text).toBe("");

      // Second chunk should be combined with the first (needs to be > 50 chars)
      const secondChunk = "b".repeat(100); // Large enough to trigger split paste detection
      buffer.handleInput(secondChunk, { ctrl: false, meta: false } as any);

      // Flush to finalize the rapid input synchronously
      buffer.flushPendingInput();

      // Should show only one placeholder with combined content
      expect(buffer.text).toBe("[Paste #1]");

      // Verify the combined content is stored correctly
      buffer.expandAllPasteBlocks();
      const expectedContent = firstChunk + secondChunk;
      expect(buffer.text).toBe(expectedContent);
    });

    it("should expand paste blocks on submission (simulating Enter key behavior)", () => {
      // Add some text before the paste
      buffer.insertText("Command: ");

      // Add a large paste that gets collapsed
      const pastedCode =
        'function example() {\n  console.log("hello");\n  ' +
        "x".repeat(COLLAPSE_SIZE);
      buffer.handleInput(pastedCode, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();

      // Verify it's collapsed
      expect(buffer.text).toBe("Command: [Paste #1, 3 lines]");

      // Simulate what happens when user presses Enter - UserInput calls expandAllPasteBlocks()
      buffer.expandAllPasteBlocks();

      // Should now show the full content with normalized line endings
      const expectedFullText =
        'Command: function example() {\n  console.log("hello");\n  ' +
        "x".repeat(COLLAPSE_SIZE);
      expect(buffer.text).toBe(expectedFullText);

      // Verify paste map is cleared after expansion
      buffer.expandAllPasteBlocks(); // Should be no-op now
      expect(buffer.text).toBe(expectedFullText); // Should remain the same
    });
  });

  describe("handleInput", () => {
    beforeEach(() => {
      buffer.setText("hello");
      buffer.setCursor(2);
    });

    it("should handle regular character input", () => {
      const result = buffer.handleInput("X", {} as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe("heXllo");
      expect(buffer.cursor).toBe(3);
    });

    it("should handle multi-character input (paste)", () => {
      const result = buffer.handleInput("XYZ", {} as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe("heXYZllo");
      expect(buffer.cursor).toBe(5);
    });

    it("should handle ctrl+a (move to start)", () => {
      const result = buffer.handleInput("a", { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(0);
    });

    it("should handle ctrl+e (move to end)", () => {
      const result = buffer.handleInput("e", { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(5);
    });

    it("should handle ctrl+u (delete to start)", () => {
      const result = buffer.handleInput("u", { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe("llo");
      expect(buffer.cursor).toBe(0);
    });

    it("should handle ctrl+k (delete to end)", () => {
      const result = buffer.handleInput("k", { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe("he");
      expect(buffer.cursor).toBe(2);
    });

    it("should handle arrow keys", () => {
      let result = buffer.handleInput("", { leftArrow: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(1);

      result = buffer.handleInput("", { rightArrow: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(2);
    });

    it("should handle delete key", () => {
      const result = buffer.handleInput("", { delete: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe("hllo");
      expect(buffer.cursor).toBe(1);
    });

    it("should handle backspace key", () => {
      const result = buffer.handleInput("", { backspace: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe("hllo");
      expect(buffer.cursor).toBe(1);
    });

    it("should handle meta key combinations", () => {
      const result = buffer.handleInput("", {
        meta: true,
        leftArrow: true,
      } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(0);
    });

    it("should handle option key sequences", () => {
      const result = buffer.handleInput("\u001b\u007f", {} as any);
      expect(result).toBe(true);
      // Should delete word backward
      expect(buffer.text).toBe("llo");
      expect(buffer.cursor).toBe(0);
    });

    it("should return false for unhandled input", () => {
      const result = buffer.handleInput("", { ctrl: true } as any);
      expect(result).toBe(false);
    });
  });

  describe("renderWithCursor", () => {
    it("should return text and cursor position", () => {
      buffer.setText("hello");
      buffer.setCursor(2);
      const result = buffer.renderWithCursor();
      expect(result).toEqual({
        text: "hello",
        cursorPosition: 2,
      });
    });

    it("should return placeholder when text is empty", () => {
      const result = buffer.renderWithCursor("Enter text...");
      expect(result).toEqual({
        text: "Enter text...",
        cursorPosition: 0,
      });
    });

    it("should return actual text even when placeholder is provided", () => {
      buffer.setText("hello");
      buffer.setCursor(2);
      const result = buffer.renderWithCursor("Enter text...");
      expect(result).toEqual({
        text: "hello",
        cursorPosition: 2,
      });
    });
  });
});
