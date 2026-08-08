import {
  COLLAPSE_SIZE,
  RAPID_INPUT_THRESHOLD,
  TextBuffer,
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

  describe("paste detection and collapse", () => {
    describe("basic collapse behavior", () => {
      it("should not collapse short content", () => {
        const shortText = "hello world";
        buffer.handleInput(shortText, { ctrl: false, meta: false } as any);
        expect(buffer.text).toBe("hello world");
      });

      it("should collapse content exceeding threshold", () => {
        const longText = "a".repeat(COLLAPSE_SIZE + 1);
        buffer.handleInput(longText, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();
        expect(buffer.text).toBe("[Paste #1]");
      });

      it("should count lines correctly in placeholders", () => {
        const multiLineText =
          "line1\nline2\nline3\n" + "a".repeat(COLLAPSE_SIZE);
        buffer.handleInput(multiLineText, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();
        expect(buffer.text).toBe("[Paste #1, 4 lines]");
      });
    });

    describe("expansion and state management", () => {
      it("should expand collapsed content on demand", () => {
        const longText = "content " + "a".repeat(COLLAPSE_SIZE);
        buffer.handleInput(longText, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();

        expect(buffer.text).toBe("[Paste #1]");
        buffer.expandAllPasteBlocks();
        expect(buffer.text).toBe(longText);
      });

      it("should increment paste counter for multiple pastes", () => {
        const text1 = "a".repeat(COLLAPSE_SIZE + 1);
        const text2 = "b".repeat(COLLAPSE_SIZE + 1);

        buffer.handleInput(text1, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();
        buffer.insertText(" ");
        buffer.handleInput(text2, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();

        expect(buffer.text).toBe("[Paste #1] [Paste #2]");
      });

      it("should normalize line endings when expanding", () => {
        const textWithMixedEndings =
          "line1\r\nline2\rline3\n" + "a".repeat(COLLAPSE_SIZE);
        buffer.handleInput(textWithMixedEndings, {
          ctrl: false,
          meta: false,
        } as any);
        buffer.flushPendingInput();

        buffer.expandAllPasteBlocks();
        const expected = "line1\nline2\nline3\n" + "a".repeat(COLLAPSE_SIZE);
        expect(buffer.text).toBe(expected);
      });

      it("should clear paste map after expansion", () => {
        const longText = "a".repeat(COLLAPSE_SIZE + 1);
        buffer.handleInput(longText, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();

        buffer.expandAllPasteBlocks();
        buffer.expandAllPasteBlocks(); // Second call should be no-op
        expect(buffer.text).toBe(longText);
      });
    });

    describe("rapid input detection (Terminal.app/Ghostty)", () => {
      it("should detect large single input as rapid paste", () => {
        const rapidText = "x".repeat(RAPID_INPUT_THRESHOLD + 1);
        buffer.handleInput(rapidText, { ctrl: false, meta: false } as any);

        expect(buffer.text).toBe(""); // Should be buffered
        expect(buffer.isInRapidInputMode()).toBe(true);

        buffer.flushPendingInput();
        expect(buffer.text).toBe(rapidText); // < COLLAPSE_SIZE, so not collapsed
      });

      it("should combine multiple chunks into single paste", () => {
        const chunk1 = "a".repeat(200);
        const chunk2 = "b".repeat(700); // Combined > COLLAPSE_SIZE

        buffer.handleInput(chunk1, { ctrl: false, meta: false } as any);
        buffer.handleInput(chunk2, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();

        expect(buffer.text).toBe("[Paste #1]");
        buffer.expandAllPasteBlocks();
        expect(buffer.text).toBe(chunk1 + chunk2);
      });

      it("should detect 50+ char chunks as start of paste session", () => {
        const smallChunk = "x".repeat(60); // >= 50, should trigger
        const largeChunk = "y".repeat(800);

        buffer.handleInput(smallChunk, { ctrl: false, meta: false } as any);
        expect(buffer.text).toBe("");

        buffer.handleInput(largeChunk, { ctrl: false, meta: false } as any);
        buffer.flushPendingInput();

        expect(buffer.text).toBe("[Paste #1]");
        buffer.expandAllPasteBlocks();
        expect(buffer.text).toBe(smallChunk + largeChunk);
      });
    });

    describe("bracketed paste (iTerm2)", () => {
      it("should handle bracketed paste sequences", () => {
        const content = "function test() { return 'hello'; }" + "x".repeat(800);

        buffer.handleInput("\u001b[200~", { ctrl: false, meta: false } as any);
        expect(buffer.isInPasteMode()).toBe(true);
        expect(buffer.text).toBe("");

        buffer.handleInput(content, { ctrl: false, meta: false } as any);
        expect(buffer.text).toBe(""); // Nothing visible during paste

        buffer.handleInput("\u001b[201~", { ctrl: false, meta: false } as any);
        expect(buffer.isInPasteMode()).toBe(false);
        expect(buffer.text).toBe("[Paste #1]");

        buffer.expandAllPasteBlocks();
        expect(buffer.text).toBe(content);
      });

      it("should not collapse short bracketed content", () => {
        const shortContent = "Hello world!";

        buffer.handleInput("\u001b[200~", { ctrl: false, meta: false } as any);
        buffer.handleInput(shortContent, { ctrl: false, meta: false } as any);
        buffer.handleInput("\u001b[201~", { ctrl: false, meta: false } as any);

        expect(buffer.text).toBe(shortContent);
      });

      it("should prioritize bracketed paste over rapid input", () => {
        const largeContent = "x".repeat(1000);

        buffer.handleInput("\u001b[200~", { ctrl: false, meta: false } as any);
        buffer.handleInput(largeContent, { ctrl: false, meta: false } as any);

        expect(buffer.isInPasteMode()).toBe(true);
        expect(buffer.isInRapidInputMode()).toBe(false);

        buffer.handleInput("\u001b[201~", { ctrl: false, meta: false } as any);
        expect(buffer.text).toBe("[Paste #1]");
      });
    });
  });

  describe("timing behavior", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should combine chunks within 200ms timing window", () => {
      const chunk1 = "x".repeat(100);
      const chunk2 = "y".repeat(800);

      buffer.handleInput(chunk1, { ctrl: false, meta: false } as any);

      vi.advanceTimersByTime(100); // Within 200ms window
      buffer.handleInput(chunk2, { ctrl: false, meta: false } as any);

      vi.advanceTimersByTime(250); // Finalize

      expect(buffer.text).toBe("[Paste #1]");
      buffer.expandAllPasteBlocks();
      expect(buffer.text).toBe(chunk1 + chunk2);
    });

    it("should finalize buffered content after 200ms timeout", () => {
      const chunk = "x".repeat(100);

      buffer.handleInput(chunk, { ctrl: false, meta: false } as any);
      expect(buffer.text).toBe("");

      vi.advanceTimersByTime(250);
      expect(buffer.text).toBe(chunk);
    });

    it("should separate sessions when timing window expires", () => {
      const chunk1 = "a".repeat(60);
      const chunk2 = "b".repeat(900);

      buffer.handleInput(chunk1, { ctrl: false, meta: false } as any);
      vi.advanceTimersByTime(300); // Exceed timing window
      expect(buffer.text).toBe(chunk1);

      buffer.handleInput(chunk2, { ctrl: false, meta: false } as any);
      vi.advanceTimersByTime(250);
      expect(buffer.text).toBe(chunk1 + "[Paste #1]");
    });
  });

  describe("regression tests", () => {
    it("should prevent typing during paste accumulation (Terminal.app fix)", () => {
      const largeChunk = "x".repeat(100);
      buffer.handleInput(largeChunk, { ctrl: false, meta: false } as any);

      // Small typed input should not be mixed into paste
      const smallChunk = "abc";
      buffer.handleInput(smallChunk, { ctrl: false, meta: false } as any);
      expect(buffer.text).toBe(""); // Both chunks buffered

      buffer.flushPendingInput();
      expect(buffer.text).toBe(largeChunk + smallChunk);
    });

    it("should allow typing after paste accumulation delay", () => {
      vi.useFakeTimers();

      const largeChunk = "x".repeat(100);
      buffer.handleInput(largeChunk, { ctrl: false, meta: false } as any);

      // Advance time to simulate user typing after a delay
      vi.advanceTimersByTime(60); // so that it is treated as typing

      const typedChar = "a";
      buffer.handleInput(typedChar, { ctrl: false, meta: false } as any);
      expect(buffer.text).toBe("a"); // Typed char inserted immediately

      vi.advanceTimersByTime(250); // Finalize paste
      expect(buffer.text).toBe("a" + largeChunk);

      vi.useRealTimers();
    });

    it("should preserve all chunks when expanding (content loss fix)", () => {
      const chunks = ["a".repeat(1000), "b".repeat(1000), "c".repeat(1000)];

      chunks.forEach((chunk) => {
        buffer.handleInput(chunk, { ctrl: false, meta: false } as any);
      });
      buffer.flushPendingInput();

      expect(buffer.text).toBe("[Paste #1]");

      buffer.expandAllPasteBlocks();
      expect(buffer.text).toBe(chunks.join(""));
      expect(buffer.text.length).toBe(3000);
    });

    it("should handle complete paste-to-submit workflow", () => {
      const pastedCode = 'console.log("test");' + "x".repeat(800);

      buffer.handleInput(pastedCode, { ctrl: false, meta: false } as any);
      buffer.flushPendingInput();
      expect(buffer.text).toBe("[Paste #1]");

      // Simulate Enter key - expand before submission
      buffer.expandAllPasteBlocks();
      expect(buffer.text).toBe(pastedCode);

      buffer.clear();
      expect(buffer.text).toBe("");
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

    it("should limit ctrl+u deletion to current line", () => {
      const text = "first line\nsecond line\nthird";
      buffer.setText(text);
      buffer.setCursor(text.indexOf("second line") + "second line".length);

      const result = buffer.handleInput("u", { ctrl: true } as any);

      expect(result).toBe(true);
      expect(buffer.text).toBe("first line\n\nthird");
      expect(buffer.cursor).toBe("first line\n".length);
    });

    it("should limit ctrl+k deletion to current line", () => {
      const text = "first line\nsecond line\nthird";
      buffer.setText(text);
      buffer.setCursor(text.indexOf("second line"));

      const result = buffer.handleInput("k", { ctrl: true } as any);

      expect(result).toBe(true);
      expect(buffer.text).toBe("first line\n\nthird");
      expect(buffer.cursor).toBe(text.indexOf("second line"));
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

    it("should delete to start of line with meta+backspace", () => {
      const text = "first line\nsecond line\nthird line";
      buffer.setText(text);
      const cursorPosition = text.indexOf("second line") + "second line".length;
      buffer.setCursor(cursorPosition);

      const result = buffer.handleInput("", {
        meta: true,
        backspace: true,
      } as any);

      expect(result).toBe(true);
      expect(buffer.text).toBe("first line\n\nthird line");
      expect(buffer.cursor).toBe("first line\n".length);
    });

    it("should delete to end of line with meta+delete", () => {
      const text = "first line\nsecond line\nthird line";
      buffer.setText(text);
      const cursorPosition = text.indexOf("second line");
      buffer.setCursor(cursorPosition);

      const result = buffer.handleInput("", {
        meta: true,
        delete: true,
      } as any);

      expect(result).toBe(true);
      expect(buffer.text).toBe("first line\n\nthird line");
      expect(buffer.cursor).toBe(cursorPosition);
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
