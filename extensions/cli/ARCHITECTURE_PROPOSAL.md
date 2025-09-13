# Unified Row-Based Message Architecture

## Problem
Current ChatHistoryItemWithSplit has multiple optional fields that create complex conditional logic in MemoizedMessage:
- `splitMessage` + `styledSegments` for regular messages
- `toolResultRow` for tool results  
- Different rendering paths in MemoizedMessage

## Proposed Solution: Single Row Structure

### New Unified Type
```typescript
export type MessageRow = {
  // Row metadata
  role: "user" | "assistant" | "system" | "tool-result";
  rowType: "content" | "header" | "summary";
  
  // Unified rendering data
  segments: StyledSegment[];     // Always use segments for rendering
  
  // Visual formatting
  showBullet: boolean;           // Show ● indicator
  marginBottom: number;          // 0 for continuation rows, 1 for last row
  
  // Optional tool metadata (only for tool result rows)
  toolMeta?: {
    toolCallId: string;
    toolName: string;
  };
}
```

### Benefits
1. **Single rendering path**: MemoizedMessage always renders `segments`
2. **Consistent structure**: All message types become rows with styled segments
3. **Extensible**: New message types just need to convert to segments
4. **Simpler logic**: No more complex conditionals
5. **No unnecessary metadata**: No IDs, indexes, or grouping needed

### Conversion Examples

#### Regular User Message
```typescript
// "Hello world" → 
[{
  role: "user",
  rowType: "content", 
  segments: [{ text: "Hello world", styling: { color: "gray" } }],
  showBullet: true,
  marginBottom: 1
}]
```

#### Multi-row Assistant Message  
```typescript
// Long markdown → multiple rows
[{
  role: "assistant", 
  rowType: "content",
  segments: [{ text: "First paragraph...", styling: { color: "white" } }],
  showBullet: true,
  marginBottom: 0
}, {
  role: "assistant",
  rowType: "content", 
  segments: [{ text: "Second paragraph...", styling: { color: "white" } }],
  showBullet: false,
  marginBottom: 0
}, {
  role: "assistant",
  rowType: "content",
  segments: [{ text: "Final paragraph...", styling: { color: "white" } }],
  showBullet: false,
  marginBottom: 1
}]
```

#### Tool Results
```typescript
// Tool call → header + result rows
[{
  role: "tool-result",
  rowType: "header",
  segments: [
    { text: "●", styling: { color: "green" } },
    { text: " Read file.txt", styling: { bold: true } }
  ],
  showBullet: false,
  marginBottom: 0,
  toolMeta: { toolCallId: "call1", toolName: "Read" }
}, {
  role: "tool-result", 
  rowType: "content",
  segments: [{ text: "  File contents...", styling: { color: "white" } }],
  showBullet: false,
  marginBottom: 1,
  toolMeta: { toolCallId: "call1", toolName: "Read" }
}]
```

### Implementation Plan

1. **Replace ChatHistoryItemWithSplit** with `MessageRow[]`
2. **Update processing functions** to return `MessageRow[]`  
3. **Simplify MemoizedMessage** to single render path:
   ```typescript
   // New simplified MemoizedMessage
   return (
     <Box marginBottom={row.marginBottom}>
       <Text color={row.role === "user" ? "blue" : "white"}>
         {row.showBullet ? "●" : " "}
       </Text>
       <Text> </Text>
       <StyledSegmentRenderer segments={row.segments} />
     </Box>
   );
   ```
4. **Convert all message types** to segments upstream

### Processing Flow
```
LLM Message → processMessageToRows() → MessageRow[] → MemoizedMessage renders segments
```

### StyledSegment Analysis

Current `StyledSegment` interface:
```typescript
export interface StyledSegment {
  text: string;
  styling: {
    bold?: boolean;              // ✓ Used by Ink Text component
    italic?: boolean;            // ✓ Used by Ink Text component  
    strikethrough?: boolean;     // ✓ Used by Ink Text component
    color?: string;              // ✓ Used by Ink Text component
    backgroundColor?: string;    // ✓ Used by Ink Text component
    type?: "text" | "code" | "codeblock" | "heading" | "think";  // ❓ Only "codeblock" used
    language?: string;           // ❓ Only used when type === "codeblock"
  };
}
```

**Simplification Opportunity**: The `type` field has 5 values but only "codeblock" affects rendering (triggers syntax highlighting). The other types ("text", "code", "heading", "think") are semantic but don't change behavior.

**Recommended simplified version**:
```typescript
export interface StyledSegment {
  text: string;
  styling: {
    bold?: boolean;
    italic?: boolean; 
    strikethrough?: boolean;
    color?: string;
    backgroundColor?: string;
    codeLanguage?: string;       // If present, treat as code block with syntax highlighting
  };
}
```

This eliminates unused semantic types while preserving all actual functionality.

### Key Simplifications
- **No more conditional logic** in MemoizedMessage
- **No more optional fields** (`splitMessage?`, `styledSegments?`, `toolResultRow?`)
- **Uses array index as React key** (no need for custom IDs)
- **Flat structure** (no grouping or back-references needed)
- **Everything is segments** (consistent rendering for all message types)
- **Simplified StyledSegment** (removes unused semantic type field)

This eliminates all conditional rendering paths and creates a consistent, extensible architecture.
