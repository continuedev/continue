# Built-in Tools in Agent and Plan Mode

This document explains how Continue defines, registers, dispatches, and executes built-in tools for the Agent and Plan modes.

---

## The `Tool` interface

**Source:** `core/index.d.ts:1134`

Every tool — built-in or MCP — is described by a `Tool` object:

```ts
interface Tool {
  type: "function";
  function: {
    name: string; // machine name passed to the LLM (e.g. "read_file")
    description?: string; // LLM-visible description
    parameters?: Record<string, any>; // JSON schema for arguments
  };
  displayTitle: string; // human-readable name shown in the GUI
  readonly: boolean; // true = does not modify files (relevant for Plan mode)
  group: string; // "Built-In" for built-ins, MCP server name for MCP tools
  defaultToolPolicy?: ToolPolicy; // "allowedWithoutPermission" | "allowedWithPermission" | "disabled"
  wouldLikeTo?: string; // GUI: "would like to read file X"
  isCurrently?: string; // GUI: "is reading file X"
  hasAlready?: string; // GUI: "has read file X"
  preprocessArgs?: (args, { ide }) => Promise<args>; // validate/transform args before execution
  evaluateToolCallPolicy?: (base, parsed, processed) => ToolPolicy; // runtime policy override
  systemMessageDescription?: { prefix; exampleArgs }; // used when native tools not supported
  uri?: string; // set for HTTP/MCP tools; absent for built-ins
}
```

---

## Built-in tool names

**Source:** `core/tools/builtIn.ts:1`

```ts
export enum BuiltInToolNames {
  ReadFile = "read_file",
  ReadFileRange = "read_file_range", // experimental
  ReadCurrentlyOpenFile = "read_currently_open_file",
  EditExistingFile = "edit_existing_file",
  SingleFindAndReplace = "single_find_and_replace",
  MultiEdit = "multi_edit",
  CreateNewFile = "create_new_file",
  RunTerminalCommand = "run_terminal_command",
  GrepSearch = "grep_search",
  FileGlobSearch = "file_glob_search",
  SearchWeb = "search_web",
  FetchUrlContent = "fetch_url_content",
  ViewDiff = "view_diff",
  LSTool = "ls",
  CreateRuleBlock = "create_rule_block",
  RequestRule = "request_rule",
  CodebaseTool = "codebase", // experimental
  ReadSkill = "read_skill",
  ViewRepoMap = "view_repo_map", // experimental
  ViewSubdirectory = "view_subdirectory", // experimental
}
```

Each tool has its definition in `core/tools/definitions/` — a separate file exporting the `Tool` object with description and JSON schema.

---

## Tool registration

**Source:** `core/tools/index.ts`

Tools are assembled in two groups:

**`getBaseToolDefinitions()`** (line 6) — always present regardless of config:
`read_file`, `create_new_file`, `run_terminal_command`, `file_glob_search`, `view_diff`, `read_currently_open_file`, `ls`, `create_rule_block`, `fetch_url_content`

**`getConfigDependentToolDefinitions(params)`** (line 18) — added based on context:

| Condition                            | Tools added                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| always                               | `request_rule`, `read_skill`                                        |
| `isSignedIn`                         | `search_web`                                                        |
| `enableExperimentalTools`            | `view_repo_map`, `view_subdirectory`, `codebase`, `read_file_range` |
| `isRecommendedAgentModel(modelName)` | `multi_edit`                                                        |
| not recommended model                | `edit_existing_file`, `single_find_and_replace`                     |
| not remote                           | `grep_search`                                                       |

`isRecommendedAgentModel()` selects the more capable `multi_edit` tool for models known to handle complex multi-location edits reliably. Other models get the simpler single-edit tools.

---

## Client-side vs core-side tools

**Source:** `core/tools/builtIn.ts:28`

```ts
export const CLIENT_TOOLS_IMPLS = [
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
];
```

The three edit tools are executed in the **GUI** (browser process) because they need to drive the `VerticalDiffManager` to stream and display diffs in the VS Code editor. All other tools run in the **core** process.

---

## Mode-based tool filtering

**Source:** `gui/src/redux/selectors/selectActiveTools.ts:7`

```ts
if (mode === "chat") {
  return []; // no tools in chat mode
}

const enabledTools = tools.filter(
  (tool) => policy !== "disabled" && groupPolicy !== "exclude",
);

if (mode === "plan") {
  return enabledTools.filter(
    (t) => t.group !== BUILT_IN_GROUP_NAME || t.readonly,
  );
}

return enabledTools; // agent mode: all enabled tools
```

- **Chat:** no tools
- **Plan:** read-only built-in tools only (`readonly: true`); non-built-in tools (MCP) pass through regardless
- **Agent:** all enabled tools

This is a Redux selector — it re-runs whenever mode, tool list, or per-tool policy settings change.

---

## Native tools vs system message tools

**Source:** `gui/src/redux/thunks/streamNormalInput.ts:113`

```ts
const useNativeTools = state.config.config.experimental
  ?.onlyUseSystemMessageTools
  ? false
  : modelSupportsNativeTools(selectedChatModel);
```

**Native tool calling** (default for capable models):

- Tools are passed in `completionOptions.tools` to `llm.streamChat()`
- Converted to the OpenAI `tools` array format in `toChatBody()` (`openaiTypeConverters.ts:237`)
- LLM returns structured `tool_calls` in the response delta
- Supported models are listed in `core/llm/toolSupport.ts`

**System message tools** (fallback for models without native function calling):

- Tools are described in the system message as formatted code blocks
- `addSystemMessageToolsToSystemMessage()` appends tool descriptions to the system prompt
- The LLM generates tool calls as XML/JSON embedded in its text response
- `interceptSystemToolCalls()` parses those out of the text stream and converts them to the internal `ToolCall` format

---

## The agent loop

The agent loop runs entirely in the GUI Redux layer. Entry point: `streamNormalInput` thunk.

```
streamNormalInput({ depth })
  ├── selectActiveTools()           select tools for current mode
  ├── modelSupportsNativeTools()    decide native vs system message
  ├── constructMessages()           build ChatMessage[] incl. system prompt
  ├── llmStreamChat(messages, { tools })
  │     LLM streams response with tool_calls
  ├── tool calls accumulated in Redux state (toolCallState)
  │     fromChatCompletionChunk() → delta.tool_calls parsed
  │     addToolCallDeltaToState()  merges streaming chunks into complete calls
  ├── evaluateToolPolicies()        check permissions for each tool call
  ├── auto-approve readonly tools / wait for user approval of write tools
  │
  └── for each approved tool call:
        callToolById({ toolCallId, depth })
          ├── if CLIENT_TOOLS_IMPLS: callClientTool()      → VerticalDiffManager
          └── else: ideMessenger.request("tools/call", { toolCall })
                      → core/core.ts handler
                      → callTool() → callBuiltInTool()
                      → returns ContextItem[]
          │
          └── streamResponseAfterToolCall({ toolCallId, depth+1 })
                ├── add { role: "tool", content: renderContextItems(output), toolCallId }
                │     to chat history
                └── if all tool calls done:
                      streamNormalInput({ depth: depth+1 })  ← LOOP BACK
```

The loop terminates when the LLM produces a response with no `tool_calls`. There is no hard iteration limit in the production code (depth is tracked for debugging but not capped).

---

## Tool execution: `callTool()` and `callBuiltInTool()`

**Source:** `core/tools/callTool.ts:235` and `:187`

`callTool()` is the entry point on the core side. It:

1. Parses the JSON arguments from `toolCall.function.arguments`
2. If `tool.uri` is set: routes to `callToolFromUri()` (HTTP or MCP)
3. Otherwise: calls `callBuiltInTool(functionName, args, extras)`

`callBuiltInTool()` is a `switch` on `functionName` dispatching to individual implementation functions in `core/tools/implementations/`. Each implementation receives `ToolExtras`:

```ts
interface ToolExtras {
  ide: IDE; // file read/write, terminal, etc.
  config: Config;
  llm: ILLM;
  fetch: Fetch;
  codeBaseIndexer: CodebaseIndexer;
  onPartialOutput: (output: ContextItem[]) => void; // streams partial results
  toolCallId: string;
}
```

All implementations return `Promise<ContextItem[]>` — the tool result is one or more context items that are serialised back to the LLM as the `role: "tool"` message.

---

## System messages per mode

**Source:** `core/llm/defaultSystemMessages.ts:51`

**Chat:** instructs the model it cannot make changes; directs the user to use the Apply button or switch to Agent mode.

**Agent:** explicitly states it may call multiple read-only tools simultaneously; instructs it to use edit tools rather than outputting code blocks for changes.

**Plan:** instructs the model to use only read-only tools; directs the user to switch to Agent mode for implementation.

---

## Data flow summary

```
User sends message (Agent mode)
    │
    ▼
streamNormalInput()                     gui/src/redux/thunks/streamNormalInput.ts
  selectActiveTools()                   gui/src/redux/selectors/selectActiveTools.ts
  constructMessages()                   gui/src/redux/util/constructMessages.ts
  llmStreamChat(messages, { tools })
    │  LLM streams response
    ▼
tool_calls parsed                       core/llm/openaiTypeConverters.ts:365
  addToolCallDeltaToState()             gui/src/util/toolCallState.ts
    │
    ▼
evaluateToolPolicies()                  gui/src/redux/thunks/evaluateToolPolicies.ts
  auto-approve or await user click
    │
    ▼
callToolById()                          gui/src/redux/thunks/callToolById.ts
  ├── client tool → callClientTool()    gui/src/util/clientTools/callClientTool.ts
  │     → VerticalDiffManager (edit tools)
  └── core tool  → ideMessenger.request("tools/call")
        → core/core.ts handler
        → callTool()                    core/tools/callTool.ts:235
        → callBuiltInTool()             core/tools/callTool.ts:187
        → implementation (readFile, runTerminalCommand, ...)
        → ContextItem[]
    │
    ▼
streamResponseAfterToolCall()           gui/src/redux/thunks/streamResponseAfterToolCall.ts
  add { role:"tool", content, toolCallId } to history
  if all tools done → streamNormalInput({ depth+1 })
    │
    └─► loop until LLM responds with no tool_calls
```

---

## Key source locations

| File                                                     | Relevance                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `core/index.d.ts:1134`                                   | `Tool` interface definition                                          |
| `core/tools/builtIn.ts:1`                                | `BuiltInToolNames` enum; `CLIENT_TOOLS_IMPLS` list                   |
| `core/tools/index.ts:6`                                  | `getBaseToolDefinitions()` and `getConfigDependentToolDefinitions()` |
| `core/tools/definitions/`                                | Individual tool definition files                                     |
| `core/tools/implementations/`                            | Individual tool implementation files                                 |
| `core/tools/callTool.ts:187`                             | `callBuiltInTool()` — dispatch switch                                |
| `core/tools/callTool.ts:235`                             | `callTool()` — core entry point; URI vs built-in routing             |
| `core/llm/defaultSystemMessages.ts:51`                   | System messages for chat / agent / plan modes                        |
| `core/llm/toolSupport.ts`                                | `modelSupportsNativeTools()` — which models support function calling |
| `gui/src/redux/selectors/selectActiveTools.ts:7`         | Mode-based tool filtering                                            |
| `gui/src/redux/thunks/streamNormalInput.ts`              | Main agent loop; tool selection; LLM call                            |
| `gui/src/redux/thunks/callToolById.ts:19`                | Tool execution dispatcher (client vs core)                           |
| `gui/src/redux/thunks/streamResponseAfterToolCall.ts:37` | Posts tool result; recurses into `streamNormalInput`                 |
| `gui/src/util/toolCallState.ts`                          | Accumulates streaming tool call deltas                               |
