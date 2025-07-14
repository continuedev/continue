import { Box, Text } from "ink";
import React from "react";

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'hunk' | 'other';
  oldLine?: number;
  newLine?: number;
  content: string;
}

function parseDiffWithLineNumbers(diffContent: string): DiffLine[] {
  const lines = diffContent.split('\n');
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
      result.push({ type: 'hunk', content: line });
      currentOldLine--;
      currentNewLine--;
      continue;
    }
    if (!inHunk) {
      if (
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('diff --git') ||
        line.startsWith('index ')
      )
        continue;
      continue;
    }
    if (line.startsWith('+')) {
      currentNewLine++;
      result.push({
        type: 'add',
        newLine: currentNewLine,
        content: line.substring(1),
      });
    } else if (line.startsWith('-')) {
      currentOldLine++;
      result.push({
        type: 'del',
        oldLine: currentOldLine,
        content: line.substring(1),
      });
    } else if (line.startsWith(' ')) {
      currentOldLine++;
      currentNewLine++;
      result.push({
        type: 'context',
        oldLine: currentOldLine,
        newLine: currentNewLine,
        content: line.substring(1),
      });
    } else if (line.startsWith('\\')) {
      result.push({ type: 'other', content: line });
    }
  }
  return result;
}

export const ColoredDiff: React.FC<{ diffContent: string }> = ({ diffContent }) => {
  const parsedLines = parseDiffWithLineNumbers(diffContent);
  
  if (parsedLines.length === 0) {
    return <Text color="gray">No changes detected.</Text>;
  }

  const displayableLines = parsedLines.filter(
    (l) => l.type !== 'hunk' && l.type !== 'other',
  );

  return (
    <Box flexDirection="column">
      {displayableLines.map((line, index) => {
        const lineKey = `diff-line-${index}`;
        let gutterNumStr = '';
        let prefixSymbol = ' ';
        let dim = false;
        let backgroundColor: string | undefined = undefined;

        switch (line.type) {
          case 'add':
            gutterNumStr = (line.newLine ?? '').toString();
            backgroundColor = '#1a4a1a';
            prefixSymbol = '+';
            break;
          case 'del':
            gutterNumStr = (line.oldLine ?? '').toString();
            backgroundColor = '#4a1a1a';
            prefixSymbol = '-';
            break;
          case 'context':
            gutterNumStr = (line.newLine ?? '').toString();
            dim = true;
            prefixSymbol = ' ';
            break;
          default:
            return null;
        }

        return (
          <Box key={lineKey} flexDirection="row">
            <Text color="gray">{gutterNumStr.padEnd(4)} </Text>
            <Text backgroundColor={backgroundColor} dimColor={dim}>
              {prefixSymbol}{' '}
            </Text>
            <Text backgroundColor={backgroundColor} dimColor={dim}>
              {line.content}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};