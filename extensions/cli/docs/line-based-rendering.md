# Line-Based Chat History Rendering

## Overview

The CLI TUI uses a line-based rendering system where each line of chat content becomes a separate chat history item. This enables granular control over chat display and eliminates flickering during updates.

## Architecture

### Core Components

1. **AnsiParsingStream** (`src/ui/utils/AnsiParsingStream.ts`)
   - Custom writable stream that captures and parses ANSI escape sequences
   - Extracts styling information (colors, bold, italic, etc.) from rendered output
   - Handles RGB colors (`48;2;r;g;b`), bright colors (`90-97`), and basic colors (`30-37`)
   - Creates styled segments with position and style metadata

2. **chatHistoryLineSplitter** (`src/ui/utils/chatHistoryLineSplitter.ts`)
   - Converts `ChatHistoryItem[]` into `ChatHistoryLine[]` (line-based items)
   - Renders each message invisibly to `AnsiParsingStream` to capture styling
   - Splits multi-line content into separate line items while preserving styling
   - Handles all message types: user, assistant, system, tool calls

3. **LineBasedMessage** (`src/ui/components/LineBasedMessage.tsx`)
   - Renders individual line-based chat items
   - Converts styled segments back to React `<Text>` components
   - Handles spacing between messages automatically

4. **StaticChatContent** (`src/ui/components/StaticChatContent.tsx`)
   - Modified to use line-based rendering pipeline
   - Processes chat history through line splitter before rendering

## How It Works

### 1. Invisible Rendering
```
ChatHistoryItem → MemoizedMessage → AnsiParsingStream → ANSI codes
```

Each chat history item is rendered invisibly using the original `MemoizedMessage` component to an `AnsiParsingStream`. This captures:
- Tool calls with green dots: `● Read(file.txt)`
- Tool outputs with colored diffs: red/green backgrounds
- Markdown styling: bold, italic, code blocks
- User message gray coloring
- All spacing and indentation

### 2. ANSI Parsing
```
ANSI codes → Styled segments with position/style metadata
```

The stream parses escape sequences like:
- `\x1b[90m` → `color: 'gray'` (user messages)
- `\x1b[48;2;113;47;55m` → `backgroundColor: 'rgb(113,47,55)'` (diff red background)
- `\x1b[1m` → `bold: true`
- `\x1b[9m` → `strikethrough: true`

### 3. Line Splitting
```
Styled segments → ChatHistoryLine[] (one per line)
```

Multi-line content gets split into separate `ChatHistoryLine` items:
- Each line becomes independent chat history item
- Styling information preserved per line
- Blank lines preserved as empty segments
- Original message metadata maintained (`originalIndex`, `lineIndex`)

### 4. Re-rendering
```
ChatHistoryLine[] → React components with preserved styling
```

Line-based items are rendered with styling reconstructed:
- RGB colors converted to hex: `rgb(113,47,55)` → `#712f37`
- ANSI segments become `<Text>` components with proper props
- Spacing handled automatically from captured content

## Key Features

### Complete Styling Preservation
- **RGB colors**: Full 24-bit color support for colored diffs
- **Bright colors**: Support for gray text and other bright variants  
- **All text styles**: Bold, italic, underline, strikethrough, dim, inverse
- **Complex layouts**: Tool calls, diffs, code blocks, headers

### Universal Processing
- **All message types**: User, assistant, system messages processed identically
- **Tool calls**: Complete tool call structure (dots, names, outputs) captured
- **No special cases**: Single pipeline handles all content types
- **Blank line preservation**: Empty lines maintained for proper spacing

### Performance Optimized
- **Invisible rendering**: No visual artifacts during processing
- **Terminal width aware**: Rendering respects actual terminal dimensions
- **Static/pending split**: Line-based items work with existing Static component logic
- **Memoized components**: Efficient re-rendering with proper React keys

## Data Flow

```
ChatHistoryItem[] 
  ↓ (splitChatHistoryIntoLines)
ChatHistoryLine[] 
  ↓ (renderLineBasedMessage)  
React components with styling
  ↓ (Static/Pending rendering)
Terminal output
```

## Benefits

1. **No flickering**: Each line is a stable item in chat history
2. **Granular control**: Individual lines can be managed independently  
3. **Style fidelity**: Complete visual reproduction of original rendering
4. **Extensible**: Works with any future message types without modification
5. **Transparent**: Existing components work unchanged, styling captured automatically