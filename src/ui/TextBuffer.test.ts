import { TextBuffer } from './TextBuffer.js';

describe('TextBuffer', () => {
  let buffer: TextBuffer;

  beforeEach(() => {
    buffer = new TextBuffer();
  });

  describe('constructor', () => {
    it('should initialize with empty text by default', () => {
      expect(buffer.text).toBe('');
      expect(buffer.cursor).toBe(0);
    });

    it('should initialize with provided text', () => {
      const buffer = new TextBuffer('hello');
      expect(buffer.text).toBe('hello');
      expect(buffer.cursor).toBe(5);
    });
  });

  describe('setText', () => {
    it('should set text and maintain cursor position', () => {
      buffer.setText('hello');
      expect(buffer.text).toBe('hello');
      expect(buffer.cursor).toBe(0);
    });

    it('should adjust cursor if it exceeds text length', () => {
      buffer.setText('hello world');
      buffer.setCursor(5);
      buffer.setText('hi');
      expect(buffer.text).toBe('hi');
      expect(buffer.cursor).toBe(2);
    });
  });

  describe('setCursor', () => {
    beforeEach(() => {
      buffer.setText('hello');
    });

    it('should set cursor to valid position', () => {
      buffer.setCursor(3);
      expect(buffer.cursor).toBe(3);
    });

    it('should clamp cursor to minimum of 0', () => {
      buffer.setCursor(-5);
      expect(buffer.cursor).toBe(0);
    });

    it('should clamp cursor to maximum of text length', () => {
      buffer.setCursor(10);
      expect(buffer.cursor).toBe(5);
    });
  });

  describe('insertText', () => {
    it('should insert text at cursor position', () => {
      buffer.setText('hello');
      buffer.setCursor(2);
      buffer.insertText('XX');
      expect(buffer.text).toBe('heXXllo');
      expect(buffer.cursor).toBe(4);
    });

    it('should insert text at beginning', () => {
      buffer.setText('world');
      buffer.setCursor(0);
      buffer.insertText('hello ');
      expect(buffer.text).toBe('hello world');
      expect(buffer.cursor).toBe(6);
    });

    it('should insert text at end', () => {
      buffer.setText('hello');
      buffer.setCursor(5);
      buffer.insertText(' world');
      expect(buffer.text).toBe('hello world');
      expect(buffer.cursor).toBe(11);
    });
  });

  describe('deleteCharAt', () => {
    beforeEach(() => {
      buffer.setText('hello');
      buffer.setCursor(3);
    });

    it('should delete character at specified position', () => {
      buffer.deleteCharAt(2);
      expect(buffer.text).toBe('helo');
      expect(buffer.cursor).toBe(2);
    });

    it('should not adjust cursor if deleting before cursor', () => {
      buffer.deleteCharAt(1);
      expect(buffer.text).toBe('hllo');
      expect(buffer.cursor).toBe(2);
    });

    it('should not delete if position is out of bounds', () => {
      buffer.deleteCharAt(10);
      expect(buffer.text).toBe('hello');
      expect(buffer.cursor).toBe(3);
    });

    it('should not delete if position is negative', () => {
      buffer.deleteCharAt(-1);
      expect(buffer.text).toBe('hello');
      expect(buffer.cursor).toBe(3);
    });
  });

  describe('deleteBackward', () => {
    beforeEach(() => {
      buffer.setText('hello');
      buffer.setCursor(3);
    });

    it('should delete character before cursor', () => {
      buffer.deleteBackward();
      expect(buffer.text).toBe('helo');
      expect(buffer.cursor).toBe(2);
    });

    it('should not delete if cursor is at beginning', () => {
      buffer.setCursor(0);
      buffer.deleteBackward();
      expect(buffer.text).toBe('hello');
      expect(buffer.cursor).toBe(0);
    });
  });

  describe('deleteForward', () => {
    beforeEach(() => {
      buffer.setText('hello');
      buffer.setCursor(2);
    });

    it('should delete character at cursor position', () => {
      buffer.deleteForward();
      expect(buffer.text).toBe('helo');
      expect(buffer.cursor).toBe(2);
    });

    it('should not delete if cursor is at end', () => {
      buffer.setCursor(5);
      buffer.deleteForward();
      expect(buffer.text).toBe('hello');
      expect(buffer.cursor).toBe(5);
    });
  });

  describe('moveWordLeft', () => {
    beforeEach(() => {
      buffer.setText('hello world test');
    });

    it('should move to start of current word', () => {
      buffer.setCursor(8); // middle of "world"
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(6); // start of "world"
    });

    it('should move to start of previous word', () => {
      buffer.setCursor(6); // start of "world"
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(0); // start of "hello"
    });

    it('should skip whitespace', () => {
      buffer.setCursor(11); // space after "world"
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(6); // start of "world"
    });

    it('should not move beyond beginning', () => {
      buffer.setCursor(0);
      buffer.moveWordLeft();
      expect(buffer.cursor).toBe(0);
    });
  });

  describe('moveWordRight', () => {
    beforeEach(() => {
      buffer.setText('hello world test');
    });

    it('should move to end of current word', () => {
      buffer.setCursor(2); // middle of "hello"
      buffer.moveWordRight();
      expect(buffer.cursor).toBe(5); // end of "hello"
    });

    it('should skip whitespace to next word', () => {
      buffer.setCursor(5); // end of "hello"
      buffer.moveWordRight();
      expect(buffer.cursor).toBe(11); // end of "world"
    });

    it('should not move beyond end', () => {
      buffer.setCursor(16);
      buffer.moveWordRight();
      expect(buffer.cursor).toBe(16);
    });
  });

  describe('deleteWordBackward', () => {
    beforeEach(() => {
      buffer.setText('hello world test');
    });

    it('should delete from cursor to start of word', () => {
      buffer.setCursor(8); // middle of "world"
      buffer.deleteWordBackward();
      expect(buffer.text).toBe('hello rld test');
      expect(buffer.cursor).toBe(6);
    });

    it('should delete entire previous word', () => {
      buffer.setCursor(6); // start of "world"
      buffer.deleteWordBackward();
      expect(buffer.text).toBe('world test');
      expect(buffer.cursor).toBe(0);
    });
  });

  describe('deleteWordForward', () => {
    beforeEach(() => {
      buffer.setText('hello world test');
    });

    it('should delete from cursor to end of word', () => {
      buffer.setCursor(2); // middle of "hello"
      buffer.deleteWordForward();
      expect(buffer.text).toBe('he world test');
      expect(buffer.cursor).toBe(2);
    });

    it('should delete to next word boundary', () => {
      buffer.setCursor(5); // end of "hello"
      buffer.deleteWordForward();
      expect(buffer.text).toBe('hello test');
      expect(buffer.cursor).toBe(5);
    });
  });

  describe('movement methods', () => {
    beforeEach(() => {
      buffer.setText('hello');
      buffer.setCursor(2);
    });

    it('should move to start', () => {
      buffer.moveToStart();
      expect(buffer.cursor).toBe(0);
    });

    it('should move to end', () => {
      buffer.moveToEnd();
      expect(buffer.cursor).toBe(5);
    });

    it('should move left', () => {
      buffer.moveLeft();
      expect(buffer.cursor).toBe(1);
    });

    it('should not move left beyond start', () => {
      buffer.setCursor(0);
      buffer.moveLeft();
      expect(buffer.cursor).toBe(0);
    });

    it('should move right', () => {
      buffer.moveRight();
      expect(buffer.cursor).toBe(3);
    });

    it('should not move right beyond end', () => {
      buffer.setCursor(5);
      buffer.moveRight();
      expect(buffer.cursor).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear text and reset cursor', () => {
      buffer.setText('hello world');
      buffer.setCursor(5);
      buffer.clear();
      expect(buffer.text).toBe('');
      expect(buffer.cursor).toBe(0);
    });
  });

  describe('handleInput', () => {
    beforeEach(() => {
      buffer.setText('hello');
      buffer.setCursor(2);
    });

    it('should handle regular character input', () => {
      const result = buffer.handleInput('X', {} as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe('heXllo');
      expect(buffer.cursor).toBe(3);
    });

    it('should handle multi-character input (paste)', () => {
      const result = buffer.handleInput('XYZ', {} as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe('heXYZllo');
      expect(buffer.cursor).toBe(5);
    });

    it('should handle ctrl+a (move to start)', () => {
      const result = buffer.handleInput('a', { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(0);
    });

    it('should handle ctrl+e (move to end)', () => {
      const result = buffer.handleInput('e', { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(5);
    });

    it('should handle ctrl+u (delete to start)', () => {
      const result = buffer.handleInput('u', { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe('llo');
      expect(buffer.cursor).toBe(0);
    });

    it('should handle ctrl+k (delete to end)', () => {
      const result = buffer.handleInput('k', { ctrl: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe('he');
      expect(buffer.cursor).toBe(2);
    });

    it('should handle arrow keys', () => {
      let result = buffer.handleInput('', { leftArrow: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(1);

      result = buffer.handleInput('', { rightArrow: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(2);
    });

    it('should handle delete key', () => {
      const result = buffer.handleInput('', { delete: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe('hllo');
      expect(buffer.cursor).toBe(1);
    });

    it('should handle backspace key', () => {
      const result = buffer.handleInput('', { backspace: true } as any);
      expect(result).toBe(true);
      expect(buffer.text).toBe('hllo');
      expect(buffer.cursor).toBe(1);
    });

    it('should handle meta key combinations', () => {
      const result = buffer.handleInput('', { meta: true, leftArrow: true } as any);
      expect(result).toBe(true);
      expect(buffer.cursor).toBe(0);
    });

    it('should handle option key sequences', () => {
      const result = buffer.handleInput('\u001b\u007f', {} as any);
      expect(result).toBe(true);
      // Should delete word backward
      expect(buffer.text).toBe('llo');
      expect(buffer.cursor).toBe(0);
    });

    it('should return false for unhandled input', () => {
      const result = buffer.handleInput('', { ctrl: true } as any);
      expect(result).toBe(false);
    });
  });

  describe('renderWithCursor', () => {
    it('should return text and cursor position', () => {
      buffer.setText('hello');
      buffer.setCursor(2);
      const result = buffer.renderWithCursor();
      expect(result).toEqual({
        text: 'hello',
        cursorPosition: 2
      });
    });

    it('should return placeholder when text is empty', () => {
      const result = buffer.renderWithCursor('Enter text...');
      expect(result).toEqual({
        text: 'Enter text...',
        cursorPosition: 0
      });
    });

    it('should return actual text even when placeholder is provided', () => {
      buffer.setText('hello');
      buffer.setCursor(2);
      const result = buffer.renderWithCursor('Enter text...');
      expect(result).toEqual({
        text: 'hello',
        cursorPosition: 2
      });
    });
  });
});