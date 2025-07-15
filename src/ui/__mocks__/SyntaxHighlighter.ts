import { Text } from 'ink';
import React from 'react';

export interface SyntaxHighlighterTheme {
  keyword: string;
  string: string;
  comment: string;
  number: string;
  operator: string;
}

export const defaultTheme: SyntaxHighlighterTheme = {
  keyword: 'blue',
  string: 'green',
  comment: 'gray',
  number: 'yellow',
  operator: 'cyan',
};

export function highlightCode(code: string, language?: string): React.ReactNode[] {
  // Mock implementation that just returns the code as plain text
  return [React.createElement('ink-text', { key: 'mock-code' }, code)];
}

export function detectLanguage(code: string): string {
  // Mock implementation
  return 'javascript';
}