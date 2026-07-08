import { Text } from "ink";
import React from "react";

import {
  defaultTheme,
  detectLanguage,
  highlightCode,
  SyntaxHighlighterTheme,
} from "./SyntaxHighlighter.js";

interface MarkdownRendererProps {
  content: string | null | undefined;
  theme?: SyntaxHighlighterTheme;
}

interface MarkdownPattern {
  regex: RegExp;
  render: (content: string, key: string) => React.ReactNode;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(
  ({ content, theme = defaultTheme }) => {
    const patterns: MarkdownPattern[] = [
      {
        regex: /```(?:(\w+)\n)?([\s\S]*?)```/g,
        render: (_content, _key) => {
          // content here is the captured group, but we need to parse the full match
          return null; // This will be handled separately
        },
      },
      {
        regex: /<think>([\s\S]*?)<\/think>/g,
        render: (content, key) => (
          <Text key={key} color="dim">
            {content.trim()}
          </Text>
        ),
      },
      {
        regex: /^(#{1,6})\s+(.+)$/gm,
        render: (content, key) => (
          <Text key={key} bold>
            {content}
          </Text>
        ),
      },
      {
        regex: /\*\*(.+?)\*\*/g,
        render: (content, key) => (
          <Text key={key} bold>
            {content}
          </Text>
        ),
      },
      {
        regex: /\*([^\s*][^*]*[^\s*]|[^\s*])\*/g,
        render: (content, key) => (
          <Text key={key} italic>
            {content}
          </Text>
        ),
      },
      {
        regex: /_([^_]+)_/g,
        render: (content, key) => (
          <Text key={key} italic>
            {content}
          </Text>
        ),
      },
      {
        regex: /~~([^~]+)~~/g,
        render: (content, key) => (
          <Text key={key} strikethrough>
            {content}
          </Text>
        ),
      },
      {
        regex: /`([^`\n]+)`/g,
        render: (content, key) => (
          <Text key={key} color="magentaBright">
            {content}
          </Text>
        ),
      },
    ];

    const renderMarkdown = (text: string | null | undefined) => {
      const parts: React.ReactNode[] = [];

      // Handle null/undefined text
      if (!text) {
        return parts;
      }

      let currentIndex = 0;

      // First, handle code blocks separately
      const codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;
      const codeBlocks: Array<{
        index: number;
        length: number;
        language: string;
        code: string;
      }> = [];

      let codeMatch;
      while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
        const language = codeMatch[1] || detectLanguage(codeMatch[2]);
        codeBlocks.push({
          index: codeMatch.index,
          length: codeMatch[0].length,
          language,
          code: codeMatch[2].trim(),
        });
      }

      // Find all matches for other patterns (excluding code blocks)
      const allMatches: Array<{
        index: number;
        length: number;
        content: string;
        render: (content: string, key: string) => React.ReactNode;
      }> = [];

      patterns.slice(1).forEach((pattern) => {
        // Skip the first pattern (code blocks)
        let match: RegExpExecArray | null;
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

        while ((match = regex.exec(text)) !== null) {
          // Skip if this match is inside a code block
          const isInCodeBlock = codeBlocks.some(
            (block) =>
              match!.index >= block.index &&
              match!.index < block.index + block.length,
          );

          if (!isInCodeBlock) {
            allMatches.push({
              index: match.index,
              length: match[0].length,
              content: match[2] || match[1], // Use second capture group for headings, first for others
              render: pattern.render,
            });
          }
        }
      });

      // Combine code blocks and other matches
      const combinedMatches: Array<{
        index: number;
        length: number;
        type: "code" | "other";
        content?: string;
        render?: (content: string, key: string) => React.ReactNode;
        language?: string;
        code?: string;
      }> = [
        ...codeBlocks.map((block) => ({
          index: block.index,
          length: block.length,
          type: "code" as const,
          language: block.language,
          code: block.code,
        })),
        ...allMatches.map((match) => ({
          index: match.index,
          length: match.length,
          type: "other" as const,
          content: match.content,
          render: match.render,
        })),
      ];

      // Sort matches by index to process them in order
      combinedMatches.sort((a, b) => a.index - b.index);

      // Process matches, avoiding overlaps
      const processedMatches: typeof combinedMatches = [];
      for (const match of combinedMatches) {
        const overlaps = processedMatches.some(
          (processed) =>
            (match.index >= processed.index &&
              match.index < processed.index + processed.length) ||
            (processed.index >= match.index &&
              processed.index < match.index + match.length),
        );

        if (!overlaps) {
          processedMatches.push(match);
        }
      }

      // Render the text with formatting
      processedMatches.forEach((match, idx) => {
        // Add text before this match
        if (match.index > currentIndex) {
          parts.push(text.slice(currentIndex, match.index));
        }

        // Add the formatted match
        if (match.type === "code") {
          const highlightedCode = highlightCode(
            match.code!,
            match.language!,
            theme,
          );
          parts.push(
            <Text key={`code-${idx}-${match.index}`}>{highlightedCode}</Text>,
          );
        } else {
          parts.push(
            match.render!(match.content!, `format-${idx}-${match.index}`),
          );
        }

        currentIndex = match.index + match.length;
      });

      // Add remaining text
      if (currentIndex < text.length) {
        parts.push(text.slice(currentIndex));
      }

      return parts;
    };

    return <Text>{renderMarkdown(content)}</Text>;
  },
);

MarkdownRenderer.displayName = "MarkdownRenderer";

export { defaultTheme, MarkdownRenderer };
export type { SyntaxHighlighterTheme };
