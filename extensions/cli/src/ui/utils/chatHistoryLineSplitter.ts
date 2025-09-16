import { render, Text, Box } from "ink";
import React from "react";
import type { ChatHistoryItem } from "../../../../../core/index.js";
import { MemoizedMessage } from "../components/MemoizedMessage.js";
import {
  AnsiParsingStream,
  StyledLine,
  StyledSegment,
} from "./AnsiParsingStream.js";

/**
 * Represents a single line from a chat history item with styling information
 */
export interface ChatHistoryLine extends Omit<ChatHistoryItem, "message"> {
  message: {
    role: ChatHistoryItem["message"]["role"];
    content: string; // Always a string for line content
  };
  originalIndex: number; // Index of the original chat history item
  lineIndex: number; // Index of this line within the original message
  styledSegments?: StyledSegment[]; // ANSI styling information for this line
}

/**
 * Creates a React component that renders the content invisibly to capture ANSI output
 */
function createInvisibleRenderer(
  item: ChatHistoryItem,
  index: number,
  terminalWidth: number,
) {
  // Debug tool output content to see if we have diff data
  // if (item.toolCallStates?.length) {
  //   item.toolCallStates.forEach((toolState, i) => {
  //     const output = toolState.output?.map(o => o.content).join('\n') || '';
  //     console.log(`[DEBUG] Tool ${i} (${toolState.toolCall.function.name}) output length:`, output.length);
  //     console.log(`[DEBUG] Tool ${i} contains "Diff:":`, output.includes('Diff:\n'));
  //     if (output.includes('Diff:\n')) {
  //       const diffSection = output.split('Diff:\n')[1];
  //       console.log(`[DEBUG] Diff section preview:`, diffSection?.slice(0, 200));
  //     }
  //   });
  // }

  return React.createElement(
    Box,
    { width: terminalWidth, flexDirection: "column" },
    React.createElement(MemoizedMessage, { item, index }),
  );
}

/**
 * Renders content to an invisible ANSI stream to extract styling information
 */
async function renderToAnsiStream(
  item: ChatHistoryItem,
  index: number,
  terminalWidth: number,
): Promise<StyledLine[]> {
  const ansiStream = new AnsiParsingStream();

  // Create the component to render
  const component = createInvisibleRenderer(item, index, terminalWidth);

  return new Promise((resolve, reject) => {
    try {
      // console.log(`[DEBUG] renderToAnsiStream: Rendering content with width ${terminalWidth}`);

      // Force color support for invisible rendering
      const originalForceColor = process.env.FORCE_COLOR;
      process.env.FORCE_COLOR = "1";

      // Make the stream appear as TTY to enable colors
      (ansiStream as any).isTTY = true;
      (ansiStream as any).columns = terminalWidth;
      (ansiStream as any).rows = 50;

      // Render to our ANSI parsing stream
      const { unmount } = render(component, {
        stdout: ansiStream as any,
      });

      // Wait longer for complex rendering to complete (tool outputs can be large)
      setTimeout(() => {
        try {
          unmount();

          // Restore original FORCE_COLOR setting
          if (originalForceColor !== undefined) {
            process.env.FORCE_COLOR = originalForceColor;
          } else {
            delete process.env.FORCE_COLOR;
          }

          // Check what raw data was captured
          // const rawOutput = (ansiStream as any).rawOutput || '';

          // Only log if we see RGB color codes (indicating diff content)
          // if (rawOutput.includes('48;2;')) {
          //   console.log('[DEBUG] Diff detected - Raw ANSI length:', rawOutput.length);
          //   console.log('[DEBUG] Lines with RGB colors:', rawOutput.split('\n').filter((line: string) => line.includes('48;2;')).length);
          // }

          const lines = ansiStream.getFormattedLines();

          // Only log if we have RGB styled lines
          // const rgbLines = lines.filter(l => l.segments.some(s => s.style.backgroundColor?.startsWith('rgb(')));
          // if (rgbLines.length > 0) {
          //   console.log(`[DEBUG] Found ${rgbLines.length} lines with RGB backgrounds`);
          //   console.log('[DEBUG] First RGB line:', rgbLines[0].segments.map(s => ({
          //     text: s.text,
          //     bg: s.style.backgroundColor
          //   })));
          // }

          ansiStream.reset(); // Clean up for next use
          resolve(lines);
        } catch (error) {
          reject(error);
        }
      }, 200); // Longer delay for complex tool outputs with diffs
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Splits a single ChatHistoryItem into multiple line-based items with styling preserved
 */
export async function splitChatHistoryItemIntoLines(
  item: ChatHistoryItem,
  originalIndex: number,
  terminalWidth: number,
): Promise<ChatHistoryLine[]> {
  // Handle messages without content
  if (!item.message.content) {
    return [];
  }

  try {
    // Render complete item (including tool calls) to invisible ANSI stream to get styling information
    const styledLines = await renderToAnsiStream(
      item,
      originalIndex,
      terminalWidth - 4,
    ); // Account for padding/border

    // Convert styled lines to ChatHistoryLine items
    const result: ChatHistoryLine[] = [];

    for (let lineIndex = 0; lineIndex < styledLines.length; lineIndex++) {
      const styledLine = styledLines[lineIndex];

      // Reconstruct the text content from segments
      const lineContent = styledLine.segments.map((seg) => seg.text).join("");

      // Only skip lines with cursor control codes, preserve blank lines for spacing
      if (/^\x1B\[\?25[lh]/.test(lineContent)) {
        continue;
      }

      result.push({
        ...item,
        message: {
          role: item.message.role,
          content: lineContent,
        },
        originalIndex,
        lineIndex,
        styledSegments: styledLine.segments,
      });
    }

    // If no lines were produced, return empty array - no fallback
    if (result.length === 0) {
      return [];
    }
    return result;
  } catch (error) {
    console.error("Failed to split chat history item into lines:", error);
    // No fallback - return empty array to force proper line-based rendering
    return [];
  }
}

/**
 * Splits an array of ChatHistoryItems into line-based items
 */
export async function splitChatHistoryIntoLines(
  chatHistory: ChatHistoryItem[],
  terminalWidth: number,
): Promise<ChatHistoryLine[]> {
  const result: ChatHistoryLine[] = [];

  for (let i = 0; i < chatHistory.length; i++) {
    const item = chatHistory[i];
    const lines = await splitChatHistoryItemIntoLines(item, i, terminalWidth);
    result.push(...lines);
  }

  return result;
}

/**
 * Creates a React Text component from styled segments
 */
export function createStyledTextFromSegments(
  segments: StyledSegment[],
): React.ReactElement[] {
  return segments.map((segment, index) => {
    const props: any = { key: `segment-${index}` };

    // Apply styling based on segment style
    if (segment.style.bold) props.bold = true;
    if (segment.style.italic) props.italic = true;
    if (segment.style.underline) props.underline = true;
    if (segment.style.strikethrough) props.strikethrough = true;
    if (segment.style.dim) props.dimColor = true;
    if (segment.style.inverse) props.inverse = true;

    // Handle colors - convert RGB back to Ink-compatible format
    if (segment.style.color) {
      if (segment.style.color.startsWith("rgb(")) {
        // RGB colors - Ink can handle hex colors, so convert rgb(r,g,b) to #hex
        const match = segment.style.color.match(/rgb\((\d+),(\d+),(\d+)\)/);
        if (match) {
          const r = parseInt(match[1]).toString(16).padStart(2, "0");
          const g = parseInt(match[2]).toString(16).padStart(2, "0");
          const b = parseInt(match[3]).toString(16).padStart(2, "0");
          props.color = `#${r}${g}${b}`;
        }
      } else {
        props.color = segment.style.color;
      }
    }

    if (segment.style.backgroundColor) {
      if (segment.style.backgroundColor.startsWith("rgb(")) {
        // RGB background colors
        const match = segment.style.backgroundColor.match(
          /rgb\((\d+),(\d+),(\d+)\)/,
        );
        if (match) {
          const r = parseInt(match[1]).toString(16).padStart(2, "0");
          const g = parseInt(match[2]).toString(16).padStart(2, "0");
          const b = parseInt(match[3]).toString(16).padStart(2, "0");
          props.backgroundColor = `#${r}${g}${b}`;
        }
      } else {
        props.backgroundColor = segment.style.backgroundColor;
      }
    }

    return React.createElement(Text, props, segment.text);
  });
}
