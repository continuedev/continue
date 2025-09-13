# Minimal File Reorganization for MessageRow Architecture

## Philosophy: Only Reorganize What We're Already Changing

This proposal only reorganizes files that are **already being modified** in this branch to support the new unified MessageRow architecture. We're not moving stable, working files unnecessarily.

## Files Changed in This Branch

From `git diff main --name-only`:
```
extensions/cli/src/ui/MarkdownProcessor.tsx          # Mixed concerns: logic + components
extensions/cli/src/ui/ToolResultProcessor.tsx        # Rename to .ts (pure functions)
extensions/cli/src/ui/components/MemoizedMessage.tsx # Simplify for MessageRow
extensions/cli/src/ui/hooks/useChat.helpers.ts       # Extract message processing
extensions/cli/src/ui/hooks/useChat.splitMessage.helpers.ts  # Replace with MessageRow
extensions/cli/src/ui/hooks/useChat.*.ts             # Simplify
```

## Proposed Minimal Reorganization

### Create New Directories (Only for Changed Files)
```
src/ui/
├── processors/                     # NEW: Pure business logic
│   ├── messageProcessor.ts         # From: useChat.helpers.ts processing logic
│   ├── markdownProcessor.ts        # From: MarkdownProcessor.tsx processing functions
│   └── toolResultProcessor.ts      # From: ToolResultProcessor.tsx (rename .tsx → .ts)
│
├── components/                # NEW: Only for changed components
│   ├── MessageRow.tsx              # From: MemoizedMessage.tsx (simplified)
│   └── StyledText.tsx              # From: MarkdownProcessor.tsx StyledSegmentRenderer
│
└── types/                          # NEW: Centralized types
    └── messageTypes.ts             # From: useChat.splitMessage.helpers.ts types
```

### What Stays in Current Locations
```
src/ui/components/
├── StaticChatContent.tsx           # NOT CHANGED - leave alone
├── BottomStatusBar.tsx             # NOT CHANGED - leave alone
└── [all other components]          # NOT CHANGED - leave alone

src/ui/
├── AppRoot.tsx                     # NOT CHANGED - leave alone
├── TUIChat.tsx                     # Minor changes - leave in place
└── [all other stable files]       # NOT CHANGED - leave alone

src/ui/hooks/
├── useTerminalSize.ts              # NOT CHANGED - leave alone
├── useUserInput.ts                 # NOT CHANGED - leave alone
└── useChat.ts                      # Simplified but stay in place
```

## Migration Map (Changed Files Only)

### Extract Processing Logic
```
useChat.helpers.ts → processors/messageProcessor.ts
  - processHistoryForTerminalDisplay()
  - helper functions

MarkdownProcessor.tsx → SPLIT INTO:
  - processors/markdownProcessor.ts (processing functions)
  - components/chat/StyledText.tsx (StyledSegmentRenderer component)

ToolResultProcessor.tsx → processors/toolResultProcessor.ts
  - Rename .tsx → .ts (no React components anymore)
```

### Simplify Components
```
MemoizedMessage.tsx → components/chat/MessageRow.tsx
  - Remove conditional logic
  - Use MessageRow type
  - Single rendering path

useChat.splitMessage.helpers.ts → types/messageTypes.ts
  - Extract MessageRow type
  - Remove ChatHistoryItemWithSplit
```

### Simplify Hooks
```
useChat.ts → SIMPLIFIED
  - Use processors instead of inline logic
  - Remove scattered helper imports
  - Cleaner interface

useChat.*.helpers.ts files → REMOVE/CONSOLIDATE
  - Logic moved to processors/
  - Types moved to types/
```

## Benefits

### Minimal Disruption
- Only reorganize files we're already changing
- Don't break working import paths
- Don't move stable components

### Clear Separation
- **processors/**: Pure business logic functions
- **components/chat/**: Simplified React components
- **types/**: Centralized type definitions

### Easy to Find
- Message processing logic: `processors/`
- Message rendering components: `components/chat/`
- Message types: `types/messageTypes.ts`

This creates the foundation for the MessageRow architecture while minimizing unnecessary file movement.
