import { diffWordsWithSpace, Change } from "diff";
import { Box, Text } from "ink";
import React, { useMemo } from "react";

// Color constants for diff display
const COLORS = {
  ADDITION_BG: "#325b30",
  DELETION_BG: "#712f37",
  ADDITION_HIGHLIGHT: "#59a467",
  DELETION_HIGHLIGHT: "#a75e6d",
  LINE_NUMBER: "dim",
} as const;

interface DiffLine {
  type: "add" | "del" | "context" | "hunk" | "other";
  oldLine?: number;
  newLine?: number;
  content: string;
}

function parseDiffWithLineNumbers(diffContent: string): DiffLine[] {
  const lines = diffContent.split("\n");
  const result: DiffLine[] = [];
  let currentOldLine = 0;
  let currentNewLine = 0;
  let inHunk = false;
  const hunkHeaderRegex = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/;

  for (const line of lines) {
    const hunkMatch = line.match(hunkHeaderRegex);
    if (hunkMatch) {
      currentOldLine = parseInt(hunkMatch[1], 10);
      currentNewLine = parseInt(hunkMatch[2], 10);
      inHunk = true;
      result.push({ type: "hunk", content: line });
      currentOldLine--;
      currentNewLine--;
      continue;
    }
    if (!inHunk) {
      if (
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("diff --git") ||
        line.startsWith("index ")
      )
        continue;
      continue;
    }
    if (line.startsWith("+")) {
      currentNewLine++;
      result.push({
        type: "add",
        newLine: currentNewLine,
        content: line.substring(1),
      });
    } else if (line.startsWith("-")) {
      currentOldLine++;
      result.push({
        type: "del",
        oldLine: currentOldLine,
        content: line.substring(1),
      });
    } else if (line.startsWith(" ")) {
      currentOldLine++;
      currentNewLine++;
      result.push({
        type: "context",
        oldLine: currentOldLine,
        newLine: currentNewLine,
        content: line.substring(1),
      });
    } else if (line.startsWith("\\")) {
      result.push({ type: "other", content: line });
    }
  }
  return result;
}

function useWordLevelDiff(oldContent: string, newContent: string) {
  return useMemo(() => {
    return diffWordsWithSpace(oldContent, newContent);
  }, [oldContent, newContent]);
}

function renderWordLevelContent(
  changes: Change[],
  showType: "removed" | "added",
): React.ReactNode {
  const segments: React.ReactNode[] = [];

  changes.forEach((change, index) => {
    if (showType === "removed") {
      if (change.removed) {
        // Highlight removed words with darker red
        segments.push(
          <Text key={index} backgroundColor={COLORS.DELETION_HIGHLIGHT}>
            {change.value}
          </Text>,
        );
      } else if (!change.added) {
        // Unchanged text - no special styling
        segments.push(change.value);
      }
    } else {
      if (change.added) {
        // Highlight added words with darker green
        segments.push(
          <Text key={index} backgroundColor={COLORS.ADDITION_HIGHLIGHT}>
            {change.value}
          </Text>,
        );
      } else if (!change.removed) {
        // Unchanged text - no special styling
        segments.push(change.value);
      }
    }
  });

  return <>{segments}</>;
}

const WordLevelDiffGroup: React.FC<{
  groupIndex: number;
  delLines: DiffLine[];
  addLines: DiffLine[];
}> = ({ groupIndex, delLines, addLines }) => {
  const oldContent = delLines.map((l) => l.content).join("\n");
  const newContent = addLines.map((l) => l.content).join("\n");
  const changes = useWordLevelDiff(oldContent, newContent);

  return (
    <Box key={`group-${groupIndex}`} flexDirection="column">
      <Box flexDirection="row">
        <Text color={COLORS.LINE_NUMBER}>
          {(delLines[0]?.oldLine ?? "").toString().padEnd(4)}{" "}
        </Text>
        <Text backgroundColor={COLORS.DELETION_BG}>- </Text>
        <Text backgroundColor={COLORS.DELETION_BG}>
          {renderWordLevelContent(changes, "removed")}
        </Text>
      </Box>
      <Box flexDirection="row">
        <Text color={COLORS.LINE_NUMBER}>
          {(addLines[0]?.newLine ?? "").toString().padEnd(4)}{" "}
        </Text>
        <Text backgroundColor={COLORS.ADDITION_BG}>+ </Text>
        <Text backgroundColor={COLORS.ADDITION_BG}>
          {renderWordLevelContent(changes, "added")}
        </Text>
      </Box>
    </Box>
  );
};

// Helper function to process a group of lines
function processGroup(
  group: DiffLine[],
): Array<{ type: "group" | "single"; lines: DiffLine[] }> {
  if (group.length <= 1) {
    return [{ type: "single", lines: group }];
  }

  const delLines = group.filter((l) => l.type === "del");
  const addLines = group.filter((l) => l.type === "add");

  // Only do word-level diff if we have both deletions and additions
  if (delLines.length > 0 && addLines.length > 0) {
    return [{ type: "group", lines: group }];
  }

  // Single type, treat as individual lines
  return group.map((l) => ({ type: "single" as const, lines: [l] }));
}

export const ColoredDiff: React.FC<{ diffContent: string }> = ({
  diffContent,
}) => {
  const parsedLines = parseDiffWithLineNumbers(diffContent);

  if (parsedLines.length === 0) {
    return <Text color="dim">No changes detected.</Text>;
  }

  const displayableLines = parsedLines.filter(
    (l) => l.type !== "hunk" && l.type !== "other",
  );

  const truncatedLines = displayableLines.slice(0, 16);
  const isTruncated = displayableLines.length > 16;

  // Group consecutive add/delete lines for word-level diffing
  const groupedLines: Array<{ type: "group" | "single"; lines: DiffLine[] }> =
    [];
  let currentGroup: DiffLine[] = [];

  for (let i = 0; i < truncatedLines.length; i++) {
    const line = truncatedLines[i];
    const nextLine = truncatedLines[i + 1];

    if (line.type === "add" || line.type === "del") {
      currentGroup.push(line);

      // If next line is different type or end of array, finalize the group
      if (!nextLine || (nextLine.type !== "add" && nextLine.type !== "del")) {
        groupedLines.push(...processGroup(currentGroup));
        currentGroup = [];
      }
    } else {
      groupedLines.push({ type: "single", lines: [line] });
    }
  }

  return (
    <Box flexDirection="column">
      {groupedLines.map((group, groupIndex) => {
        if (group.type === "single") {
          const line = group.lines[0];
          const lineKey = `diff-line-${groupIndex}`;
          let gutterNumStr = "";
          let prefixSymbol = " ";
          let dim = false;
          let backgroundColor: string | undefined = undefined;

          switch (line.type) {
            case "add":
              gutterNumStr = (line.newLine ?? "").toString();
              backgroundColor = COLORS.ADDITION_BG;
              prefixSymbol = "+";
              break;
            case "del":
              gutterNumStr = (line.oldLine ?? "").toString();
              backgroundColor = COLORS.DELETION_BG;
              prefixSymbol = "-";
              break;
            case "context":
              gutterNumStr = (line.newLine ?? "").toString();
              dim = true;
              prefixSymbol = " ";
              break;
            default:
              return null;
          }

          return (
            <Box key={lineKey} flexDirection="row">
              <Text color={COLORS.LINE_NUMBER}>{gutterNumStr.padEnd(4)} </Text>
              <Text backgroundColor={backgroundColor} dimColor={dim}>
                {prefixSymbol}{" "}
              </Text>
              <Text backgroundColor={backgroundColor} dimColor={dim}>
                {line.content}
              </Text>
            </Box>
          );
        } else {
          // Word-level diff group
          const delLines = group.lines.filter((l) => l.type === "del");
          const addLines = group.lines.filter((l) => l.type === "add");

          return (
            <WordLevelDiffGroup
              key={`group-${groupIndex}`}
              groupIndex={groupIndex}
              delLines={delLines}
              addLines={addLines}
            />
          );
        }
      })}
      {isTruncated && (
        <Text color="dim" dimColor>
          ... ({displayableLines.length - 16} more lines)
        </Text>
      )}
    </Box>
  );
};
