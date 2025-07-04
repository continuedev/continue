import { test, expect } from 'vitest';
import { headerIsMarkdown, isMarkdownFile, MarkdownBlockStateTracker } from './markdownUtils';

test('headerIsMarkdown correctly identifies markdown headers', () => {
  // Should return true for markdown headers
  expect(headerIsMarkdown('md')).toBe(true);
  expect(headerIsMarkdown('markdown')).toBe(true);
  expect(headerIsMarkdown('gfm')).toBe(true);
  expect(headerIsMarkdown('github-markdown')).toBe(true);
  expect(headerIsMarkdown('language md')).toBe(true);
  expect(headerIsMarkdown('language markdown')).toBe(true);
  expect(headerIsMarkdown('filename.md')).toBe(true);
  expect(headerIsMarkdown('path/to/file.md language')).toBe(true);

  // Should return false for non-markdown headers
  expect(headerIsMarkdown('javascript')).toBe(false);
  expect(headerIsMarkdown('typescript')).toBe(false);
  expect(headerIsMarkdown('python')).toBe(false);
  expect(headerIsMarkdown('')).toBe(false);
});

test('isMarkdownFile correctly identifies markdown files', () => {
  // Should return true for markdown files
  expect(isMarkdownFile('test.md')).toBe(true);
  expect(isMarkdownFile('path/to/file.markdown')).toBe(true);
  expect(isMarkdownFile('README.md')).toBe(true);

  // Should return false for non-markdown files
  expect(isMarkdownFile('test.js')).toBe(false);
  expect(isMarkdownFile('script.ts')).toBe(false);
  expect(isMarkdownFile('')).toBe(false);
  expect(isMarkdownFile(undefined)).toBe(false);
});

test('MarkdownBlockStateTracker correctly tracks nested markdown blocks', () => {
  const lines = [
    '# Header',
    '',
    'Some text',
    '',
    '```md',
    'Nested markdown content',
    '```javascript',
    'function test() {',
    '  return true;',
    '}',
    '```',
    'More nested markdown',
    '```',
    '',
    'End of file'
  ];

  const stateTracker = new MarkdownBlockStateTracker(lines);
  
  // First backtick closure is within nested block (not markdown end)
  expect(stateTracker.shouldStopAtPosition(10)).toBe(false);
  
  // This is the backtick that closes the outer markdown block
  expect(stateTracker.shouldStopAtPosition(12)).toBe(true);
});

test('MarkdownBlockStateTracker handles simple code blocks correctly', () => {
  const lines = [
    'Some code:',
    '',
    '```javascript',
    'function test() {',
    '  return true;',
    '}',
    '```',
    '',
    'More text'
  ];

  const stateTracker = new MarkdownBlockStateTracker(lines);
  
  // This is just a simple code block, not nested markdown
  expect(stateTracker.shouldStopAtPosition(6)).toBe(false);
});