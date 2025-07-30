import { Box, Text } from "ink";
import React from "react";
import { diffWordsWithSpace } from "diff";

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

function getWordLevelContent(oldContent: string, newContent: string, showType: 'removed' | 'added'): string {
  const changes = diffWordsWithSpace(oldContent, newContent);
  let result = '';
  
  changes.forEach((change) => {
    if (showType === 'removed') {
      if (change.removed || !change.added) {
        result += change.value;
      }
    } else {
      if (change.added || !change.removed) {
        result += change.value;
      }
    }
  });
  
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

  const truncatedLines = displayableLines.slice(0, 16);
  const isTruncated = displayableLines.length > 16;

  // Group consecutive add/delete lines for word-level diffing
  const groupedLines: Array<{ type: 'group' | 'single', lines: DiffLine[] }> = [];
  let currentGroup: DiffLine[] = [];
  
  for (let i = 0; i < truncatedLines.length; i++) {
    const line = truncatedLines[i];
    const nextLine = truncatedLines[i + 1];
    
    if (line.type === 'add' || line.type === 'del') {
      currentGroup.push(line);
      
      // If next line is different type or end of array, finalize the group
      if (!nextLine || (nextLine.type !== 'add' && nextLine.type !== 'del')) {
        if (currentGroup.length > 1) {
          const delLines = currentGroup.filter(l => l.type === 'del');
          const addLines = currentGroup.filter(l => l.type === 'add');
          
          // Only do word-level diff if we have both deletions and additions
          if (delLines.length > 0 && addLines.length > 0) {
            groupedLines.push({ type: 'group', lines: currentGroup });
          } else {
            // Single type, treat as individual lines
            currentGroup.forEach(l => groupedLines.push({ type: 'single', lines: [l] }));
          }
        } else {
          groupedLines.push({ type: 'single', lines: currentGroup });
        }
        currentGroup = [];
      }
    } else {
      groupedLines.push({ type: 'single', lines: [line] });
    }
  }

  return (
    <Box flexDirection="column">
      {groupedLines.map((group, groupIndex) => {
        if (group.type === 'single') {
          const line = group.lines[0];
          const lineKey = `diff-line-${groupIndex}`;
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
        } else {
          // Word-level diff group
          const delLines = group.lines.filter(l => l.type === 'del');
          const addLines = group.lines.filter(l => l.type === 'add');
          const oldContent = delLines.map(l => l.content).join('\n');
          const newContent = addLines.map(l => l.content).join('\n');
          
          return (
            <Box key={`group-${groupIndex}`} flexDirection="column">
              <Box flexDirection="row">
                <Text color="gray">{(delLines[0]?.oldLine ?? '').toString().padEnd(4)} </Text>
                <Text backgroundColor="#4a1a1a">- {getWordLevelContent(oldContent, newContent, 'removed')}</Text>
              </Box>
              <Box flexDirection="row">
                <Text color="gray">{(addLines[0]?.newLine ?? '').toString().padEnd(4)} </Text>
                <Text backgroundColor="#1a4a1a">+ {getWordLevelContent(oldContent, newContent, 'added')}</Text>
              </Box>
            </Box>
          );
        }
      })}
      {isTruncated && (
        <Text color="gray" dimColor>
          ... ({displayableLines.length - 16} more lines)
        </Text>
      )}
    </Box>
  );
};