# Yuto — Next Session Plan

## Repo
- Continue fork at `/home/fran/dev/yuto-code/continue/`
- Marcel source at `/home/fran/dev/yuto-code/marcel/src/`

## Current State (May 4 2026)

### What's wired and working
- `core/agent/AgentRunner.ts` — full autonomous loop (stream → tool calls → batch execute → session memory)
- `core/agent/SessionMemory.ts`, `TaskState.ts`, `autoDream.ts` — supporting agent infrastructure
- `core/core.ts` handles `agent/run`, `agent/status`, `agent/abort`, `agent/questionAnswer` protocol messages
- Protocol types defined in `core/protocol/core.ts` and `core/protocol/webview.ts`
- All ported tools registered: subagent, sleep, skill, worktree x2, notifyUser, tool_search, todoWrite, askUserQuestion, lspQuery, notebookEdit, enterPlanMode, exitPlanMode

### The Single Missing Link
**The GUI never calls `agent/run`.** The VS Code extension never calls `agent/run`.
The agent loop exists but has NO trigger — it's an API with no UI entry point.

## Priority Tasks (in order)

### 1. 🔴 GUI trigger — highest ROI (2-4 days)
Build an Agent mode in the GUI that sends `agent/run` and renders live results.
Files to create:
```
gui/src/components/Agent/
  AgentChat.tsx       ← sends agent/run, polls agent/status
  AgentToolCall.tsx   ← renders tool_start / tool_result events  
  AgentStatusBar.tsx  ← turn count + abort button
```
Start by reading `gui/src/` structure and how existing chat mode sends messages.

### 2. 🟡 Wire bash utils into RunTerminalCommand (1 day)
- `core/tools/implementations/runTerminalCommand.ts` runs commands naively
- `core/util/bash/commands.ts` + `shellQuote.ts` can make it safe
- Import `extractOutputRedirections`, `isUnsafeCompoundCommand_DEPRECATED`, `quoteShellCommand`

### 3. 🟡 Context limit guard in AgentRunner (half day)
- Before each turn, call `analyzeContext(messages)` from `core/util/contextAnalysis.ts`
- Warn/truncate when approaching LLM token limit
- AgentRunner has no protection against silent mid-session context overflow

### 4. 🟡 todoWrite implementation (half day)
- `core/tools/definitions/todoWrite.ts` exists, `implementations/todoWrite.ts` may be stub
- Check and implement if needed

### 5. 🟢 VS Code command to launch agent (1 day)
- Register `yuto.runAgent` command in `extensions/vscode/src/`
- Opens agent panel, sends `agent/run` with current selection/file as context

## Files Already Ported (do not re-port)
- `core/util/bash/` — 9 files + specs/ (8 files)
- `core/util/generators.ts`, `format.ts`, `array.ts`, `shellPromptDetection.ts`
- `core/util/progressTracker.ts`, `agentContext.ts`, `contextAnalysis.ts`
- `core/agent/` — all 6 files

## YUTO.md
Exists at `continue/YUTO.md` — agent instructions for this codebase.
