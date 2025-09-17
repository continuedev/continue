import { smartTruncate, formatTruncationMessage } from './truncation.js';

describe('smartTruncate', () => {
  describe('line-based truncation', () => {
    it('should not truncate when content is within line limit', () => {
      const content = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');
      const result = smartTruncate(content, { maxLines: 100 });
      
      expect(result.truncated).toBe(false);
      expect(result.content).toBe(content);
      expect(result.originalLineCount).toBe(50);
      expect(result.truncatedLineCount).toBe(50);
    });

    it('should truncate when content exceeds line limit', () => {
      const lines = Array.from({ length: 150 }, (_, i) => `line ${i}`);
      const content = lines.join('\n');
      const result = smartTruncate(content, { maxLines: 100 });
      
      expect(result.truncated).toBe(true);
      expect(result.originalLineCount).toBe(150);
      expect(result.truncatedLineCount).toBe(100);
      
      const expectedContent = lines.slice(0, 100).join('\n');
      expect(result.content).toBe(expectedContent);
    });
  });

  describe('character-based truncation', () => {
    it('should not truncate when content is within character limit', () => {
      const content = 'short content';
      const result = smartTruncate(content, { maxChars: 1000 });
      
      expect(result.truncated).toBe(false);
      expect(result.content).toBe(content);
      expect(result.originalCharCount).toBe(13);
      expect(result.truncatedCharCount).toBe(13);
    });

    it('should truncate when content exceeds character limit', () => {
      // Create content that exceeds character limit but not line limit
      const longLine = 'x'.repeat(600); // 600 chars
      const lines = Array.from({ length: 10 }, () => longLine); // 10 lines, ~6000 chars total
      const content = lines.join('\n');
      
      const result = smartTruncate(content, { maxChars: 3000, maxLines: 100 });
      
      expect(result.truncated).toBe(true);
      expect(result.originalCharCount).toBeGreaterThan(3000);
      expect(result.truncatedCharCount).toBeLessThanOrEqual(3000);
    });
  });

  describe('long line truncation', () => {
    it('should truncate individual lines that are too long', () => {
      const veryLongLine = 'x'.repeat(2000); // Simulates base64 or other long content
      const content = `normal line\n${veryLongLine}\nanother normal line`;
      
      const result = smartTruncate(content, { maxLineLength: 1000 });
      
      expect(result.truncated).toBe(true);
      expect(result.content).toContain('... [line truncated]');
      expect(result.content.split('\n')[1].length).toBeLessThan(veryLongLine.length);
    });

    it('should handle base64-like content', () => {
      // Simulate a file with base64 content
      const base64Content = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAA'.repeat(100);
      const content = `file.js:1:const image = "${base64Content}";`;
      
      const result = smartTruncate(content, { maxLineLength: 200 });
      
      expect(result.truncated).toBe(true);
      expect(result.content).toContain('... [line truncated]');
      expect(result.content.length).toBeLessThan(content.length);
    });
  });

  describe('combined limits', () => {
    it('should respect whichever limit is hit first', () => {
      // Create content that hits character limit before line limit
      const longLines = Array.from({ length: 50 }, (_, i) => 'x'.repeat(200) + ` line ${i}`);
      const content = longLines.join('\n');
      
      const result = smartTruncate(content, { 
        maxLines: 100, 
        maxChars: 5000,
        maxLineLength: 1000
      });
      
      expect(result.truncated).toBe(true);
      expect(result.truncatedLineCount).toBeLessThan(50); // Hit char limit first
      expect(result.truncatedCharCount).toBeLessThanOrEqual(5000);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = smartTruncate('');
      
      expect(result.truncated).toBe(false);
      expect(result.content).toBe('');
      expect(result.originalLineCount).toBe(1); // split('\n') on empty string gives ['']
      expect(result.truncatedLineCount).toBe(1);
    });

    it('should handle single very long line', () => {
      const veryLongContent = 'x'.repeat(100000);
      const result = smartTruncate(veryLongContent, { maxChars: 1000 });
      
      expect(result.truncated).toBe(true);
      expect(result.truncatedCharCount).toBeLessThanOrEqual(1000);
    });

    it('should handle content with only newlines', () => {
      const content = '\n'.repeat(200);
      const result = smartTruncate(content, { maxLines: 100 });
      
      expect(result.truncated).toBe(true);
      expect(result.truncatedLineCount).toBe(100);
    });
  });
});

describe('formatTruncationMessage', () => {
  it('should return empty string when not truncated', () => {
    const result = {
      content: 'test',
      truncated: false,
      originalLineCount: 5,
      truncatedLineCount: 5,
      originalCharCount: 100,
      truncatedCharCount: 100,
    };
    
    expect(formatTruncationMessage(result)).toBe('');
  });

  it('should format line truncation message', () => {
    const result = {
      content: 'test',
      truncated: true,
      originalLineCount: 150,
      truncatedLineCount: 100,
      originalCharCount: 1000,
      truncatedCharCount: 800,
    };
    
    const message = formatTruncationMessage(result);
    expect(message).toContain('showing 100 of 150 matches');
  });

  it('should format character truncation message', () => {
    const result = {
      content: 'test',
      truncated: true,
      originalLineCount: 50,
      truncatedLineCount: 50,
      originalCharCount: 50000,
      truncatedCharCount: 25000,
    };
    
    const message = formatTruncationMessage(result);
    expect(message).toContain('25KB of 50KB total');
  });

  it('should format combined truncation message', () => {
    const result = {
      content: 'test',
      truncated: true,
      originalLineCount: 150,
      truncatedLineCount: 100,
      originalCharCount: 50000,
      truncatedCharCount: 25000,
    };
    
    const message = formatTruncationMessage(result);
    expect(message).toContain('showing 100 of 150 matches');
    expect(message).toContain('25KB of 50KB total');
  });

  it('should not show KB message when difference is negligible', () => {
    const result = {
      content: 'test',
      truncated: true,
      originalLineCount: 150,
      truncatedLineCount: 100,
      originalCharCount: 1200,
      truncatedCharCount: 1100,
    };
    
    const message = formatTruncationMessage(result);
    expect(message).toContain('showing 100 of 150 matches');
    expect(message).not.toContain('KB');
  });
});