import { Text } from "ink";
import React from "react";

interface MarkdownRendererProps {
  content: string;
}

interface MarkdownPattern {
  regex: RegExp;
  render: (content: string, key: string) => React.ReactNode;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const patterns: MarkdownPattern[] = [
    {
      regex: /```([\s\S]*?)```/g,
      render: (content, key) => (
        <Text key={key} color="cyan">
          {content}
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
      regex: /`([^`]+)`/g,
      render: (content, key) => (
        <Text key={key} color="cyan">
          {content}
        </Text>
      ),
    },
  ];

  const renderMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // Find all matches for all patterns
    const allMatches: Array<{
      index: number;
      length: number;
      content: string;
      render: (content: string, key: string) => React.ReactNode;
    }> = [];

    patterns.forEach((pattern) => {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

      while ((match = regex.exec(text)) !== null) {
        allMatches.push({
          index: match.index,
          length: match[0].length,
          content: match[2] || match[1], // Use second capture group for headings, first for others
          render: pattern.render,
        });
      }
    });

    // Sort matches by index to process them in order
    allMatches.sort((a, b) => a.index - b.index);

    // Process matches, avoiding overlaps
    let processedMatches: typeof allMatches = [];
    for (const match of allMatches) {
      const overlaps = processedMatches.some(
        (processed) =>
          (match.index >= processed.index &&
            match.index < processed.index + processed.length) ||
          (processed.index >= match.index &&
            processed.index < match.index + match.length)
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
      parts.push(match.render(match.content, `format-${idx}-${match.index}`));

      currentIndex = match.index + match.length;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.slice(currentIndex));
    }

    return parts;
  };

  return <Text>{renderMarkdown(content)}</Text>;
};

export default MarkdownRenderer;
