import { Text } from "ink";
import React from "react";

import { highlightCode, defaultTheme } from "../SyntaxHighlighter.js";
import type { StyledSegment } from "../types/messageTypes.js";

/**
 * Renders styled segments with unified formatting
 * Replaces StyledSegmentRenderer from MarkdownProcessor.tsx
 */
export function StyledSegmentRenderer({
  segments,
}: {
  segments: StyledSegment[];
}): React.ReactElement {
  return (
    <>
      {segments.map((segment, index) => {
        const { text, styling } = segment;

        // Handle code blocks with syntax highlighting
        if (styling.codeLanguage) {
          const highlightedElements = highlightCode(
            text,
            styling.codeLanguage,
            defaultTheme,
          );
          return (
            <React.Fragment key={index}>{highlightedElements}</React.Fragment>
          );
        }

        // Handle regular styled text
        return (
          <Text
            key={index}
            bold={styling.bold}
            italic={styling.italic}
            strikethrough={styling.strikethrough}
            color={styling.color}
            backgroundColor={styling.backgroundColor}
          >
            {text}
          </Text>
        );
      })}
    </>
  );
}
