# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

shadow-code is a fork of Continue (the open-source AI coding agent - VS Code extension, JetBrains plugin, and CLI; upstream is now read-only/unmaintained, so this fork is the active codebase going forward).

The fork exists to add one capability Continue doesn't have: **using coding-agent CLIs the user already has a subscription for (Claude Code CLI first, later Codex CLI / GitHub Copilot CLI) as the model-execution backend, instead of paying per-token for an API key.** The design constraint driving all of this is that **Continue's own harness stays authoritative** - its own system prompt, its own tool definitions, its own permission/approval flow. The CLI is used purely for authenticated model execution, never for its own built-in agent loop (its Read/Write/Edit/Bash tools are explicitly disabled on every invocation).

### The Claude Code CLI integration

- `core/llm/llms/ClaudeCodeCli.ts` - an `ILLM` provider (`providerName: "claudecode"`) that implements `_streamChat` by spawning `claude -p --output-format stream-json` per turn instead of making an HTTP call. Key decisions, don't relitigate without reason:
  - `--tools ""` disables every Claude Code built-in; `--system-prompt` (full override, not `--append-system-prompt`) makes Continue's system prompt authoritative; `--permission-mode bypassPermissions` because there's no terminal to prompt against in `-p` mode (our own MCP server is the real approval gate, not Claude Code's).
  - Deliberately **not** using `--bare` - it forces API-key-only auth (no OAuth/keychain), which would defeat the entire point of running through a Pro/Max/Team subscription.
  - No `--session-id`/`--resume` continuity. Each call is a fresh Claude Code session; multi-turn memory instead reuses the existing **Ultra Token Saving** mode (`core/llm/tokenOptimizedChat.ts`, `core/data/shadowChatDb.ts`) that every provider already has: only `[systemMessage, currentUserMessage]` is sent, and the model pulls earlier turns back on demand via the `shadow_*` tools (`shadow_get_chat_history`, `shadow_search_messages`, etc.). For this provider, Ultra Token Saving is forced on unconditionally in `core/llm/streamChat.ts` regardless of the user's setting, because it isn't optional here - without it there is no cross-turn memory at all.
  - Tool calls Claude Code makes are already fully resolved (via MCP) by the time they appear in the output stream, so the provider yields them as _paired_ `{role: "assistant", toolCalls}` → `{role: "tool", toolCallId, content}` chunks - this is what tells Continue's UI/state machine "already-resolved history," not "pending work," matching how `tokenOptimizedStreamChat` already renders shadow tool calls. `tokenOptimizedChat.ts` has an explicit `providerName === "claudecode"` bypass so its own interception loop doesn't try to re-execute (and double-run) anything.
- `core/mcp/shadowCodeToolsServer.ts` - `ShadowCodeToolsMcpServer`, an MCP server exposing Continue's own tools (not Claude Code's) to the spawned CLI. Runs **in-process inside Core** as a Streamable HTTP server on `127.0.0.1` (not stdio, not a separate binary) so tool execution has direct access to the same config/execution path `handleToolCall` already uses. **Must use stateful mode** (`sessionIdGenerator: () => randomUUID()`) - stateless mode is broken on Windows in the installed `@modelcontextprotocol/sdk` version (confirmed by direct repro: every request after the first silently 500s). The tool set exposed is session-scoped (`registerToolsForSession`/`resolveTools`), matching whatever `options.tools` was active for that specific turn rather than a static reload of `config.tools`.
- Approval bridge: `claudeCodeCli/authorizeToolCall` (`core/protocol/webview.ts`) is a Core → GUI request/response message. The MCP server's `CallTool` handler blocks on it before executing anything; `gui/src/hooks/ClaudeCodeCliApprovalGate.tsx` answers it by reusing the real `evaluateToolPolicy` (exported from `gui/src/redux/thunks/evaluateToolPolicies.ts`) against the user's actual tool settings, only showing an interactive Allow/Deny banner when the resolved policy is `allowedWithPermission`.
- `core/llm/tokenOptimizedChat.ts` and `core/llm/streamChat.ts` thread a `shadowSessionId` field through `CompletionOptions` (`core/index.d.ts`) so `ClaudeCodeCli` uses the _same_ ShadowChatDb session id the rest of the pipeline recorded history under (Continue's real GUI session id when available), not an independently-derived one - they'd otherwise disagree whenever a real session id exists, silently breaking `shadow_get_chat_history`.
- `core/tools/implementations/serverSideEdit.ts` - `single_find_and_replace` and `multi_edit` now work when called via MCP (they're normally client-only, `CLIENT_TOOLS_IMPLS` in `core/tools/builtIn.ts`, so the GUI can stream a live diff preview). This reuses the _same_ deterministic `tool.preprocessArgs` computation the GUI's client-side implementations already depend on (`core/edit/searchAndReplace/*`) and just writes the file directly, skipping the live-preview UX. `edit_existing_file` (the freeform "changes" sketch format) has **no** server-side implementation - there's no deterministic reconciliation for it anywhere in this codebase, only the GUI's interactive apply flow - so it returns a message redirecting the model to `single_find_and_replace`/`multi_edit` instead of silently failing or risking a bad patch.

### Known open items

- `shadow-mcp` (a separate Go MCP gateway/aggregator binary, `github.com/deepak-s-2000/shadow-mcp`) was deliberately deferred, not rejected - its value (multi-server aggregation, lazy tool-catalog loading, profile-based filtering) only pays for the packaging cost (per-platform binary, code signing) once there's more than one downstream MCP server to front. Revisit if/when Codex CLI / Copilot CLI integrations need it.
- Built and verified with real `claude` CLI invocations (flag behavior, MCP handshake, event shapes) and `tsc --noEmit`, but never inside a running VS Code extension host - GUI-side rendering (approval banner, tool-call cards) is unconfirmed visually.
- Extending to Codex CLI / Copilot CLI: the MCP-exposure and approval-bridge pieces (`shadowCodeToolsServer.ts`, `claudeCodeCli/authorizeToolCall`) are provider-agnostic by construction; only a new `ILLM` subclass analogous to `ClaudeCodeCli.ts` should be needed, with per-vendor flag/transport differences contained there.

## Commands

This is an npm workspaces monorepo; most packages are developed independently from their own directory.

```bash
# Root: format all packages, or type-check-watch everything at once
npm run format          # prettier --write
npm run format:check
npm run tsc:watch        # watches gui + vscode + core + binary concurrently
```

**core/** (the shared engine - config, LLM providers, tools, indexing):

```bash
cd core
npm run tsc:check                          # type-check
npm run lint                               # eslint . --ext ts
npm test                                   # Jest - *.test.ts files
npm run vitest                             # Vitest - *.vitest.ts files (preferred for new tests)
npm test -- path/to/file.test.ts           # single Jest test file
npx vitest run path/to/file.vitest.ts      # single Vitest test file
npm run build                              # tsc -p ./tsconfig.npm.json
```

**gui/** (React webview):

```bash
cd gui
npm run dev            # vite dev server
npm run tsc:check
npm run lint
npm test                              # vitest run
npx vitest run path/to/File.test.tsx  # single test file
npm run build           # tsc && vite build
```

**extensions/vscode/** (the VS Code extension host):

```bash
cd extensions/vscode
npm run esbuild-watch    # rebuild on change
npm run tsc:check
npm run lint
npm run package          # produce a .vsix
```

**binary/** (packages core as a standalone executable for JetBrains/other IDEs):

```bash
cd binary
npm test
npm run build            # node build.js
```

## Architecture

Standard Continue layout - four packages talk to each other over a typed message-passing protocol, not direct imports:

- **`core/`** - IDE-agnostic engine: LLM provider implementations (`core/llm/llms/`), the tool system (`core/tools/`), config loading, indexing, MCP client code (`core/context/mcp/`). Runs as a long-lived child process (the "binary") separate from the extension host.
- **`gui/`** - the React webview UI, communicates with Core exclusively via `IIdeMessenger` (`gui/src/context/IdeMessenger.tsx`) and Redux (`gui/src/redux/`).
- **`extensions/vscode/`** - the VS Code extension host; relays messages between the webview and the Core process.
- **`extensions/cli`**, **`extensions/intellij`** - other front-ends onto the same Core.
- **`binary/`** - bundles `core/` into a platform-specific standalone executable (`pkg`) that non-VS Code front-ends spawn.

**Message protocol** (`core/protocol/`): every cross-process message type is declared once and consumed on both ends by name - there is no per-message-type relay code to write when adding a new one, just the type declaration plus a sender (`messenger.request`/`.send`) and receiver (`.on` on the Core side, `useWebviewListener` on the GUI side).

- `core/protocol/core.ts` → `ToCoreFromIdeOrWebviewProtocol`: GUI/IDE → Core requests (e.g. `tools/call`, `tools/evaluatePolicy`).
- `core/protocol/webview.ts` → `ToWebviewFromIdeOrCoreProtocol`: Core/IDE → GUI requests/pushes (e.g. `configUpdate`, `claudeCodeCli/authorizeToolCall`). A Core-initiated request that blocks on a GUI response (not just a one-way push) is a real, supported pattern here - see `claudeCodeCli/authorizeToolCall` for the shape.
- `core/protocol/index.ts` composes the directional types (`ToCoreProtocol`, `FromCoreProtocol`, `ToWebviewProtocol`, ...) from the per-pair files.

**Tool execution & approval** (this is the part that requires reading several files together to understand): a tool call from the model normally becomes an `AssistantChatMessage.toolCalls` entry; the GUI (`gui/src/redux/thunks/evaluateToolPolicies.ts`) resolves a `ToolPolicy` (`disabled` / `allowedWithPermission` / `allowedWithoutPermission`) by combining the tool's `defaultToolPolicy`, the user's stored override, and any dynamic per-args policy (`tool.evaluateToolCallPolicy`, round-tripped through Core via `tools/evaluatePolicy`). Only if the policy is `allowedWithoutPermission` does the GUI immediately call `tools/call`; otherwise the call sits pending in Redux until the user clicks Allow in `PendingToolCallToolbar.tsx`, which is what finally sends `tools/call`. **There is no server-side blocking/await for approval in the normal flow** - Core's `handleToolCall` (`core/core.ts`) executes unconditionally whenever it receives `tools/call`; the GUI is what decides whether/when to send it. The Claude Code CLI integration had to build its own version of this gate (`claudeCodeCli/authorizeToolCall`) precisely because tool calls there originate from inside a spawned subprocess, not from the GUI's normal streaming loop.

**Provider registration** (`core/llm/llms/index.ts`): providers are plain classes with a static `providerName`, collected into the `LLMClasses` array and matched by that string in `llmFromDescription`. Adding a provider is additive - `class Foo extends BaseLLM { static providerName = "..." }`, implement `_streamChat`, add to the array.

## Conventions (from `.shadow-code/rules/`)

- Prefer functional programming; modifying existing classes or a singleton is fine when that's genuinely the right shape, but default to functions.
- Prefer `enum` over string-literal unions in TypeScript where reasonable.
- New tests: prefer Vitest (`*.vitest.ts` in core, `*.test.tsx` in gui) over Jest. Write tests as top-level `test()` functions, not inside `describe()` blocks; put the function name under test in the description.
- Don't add features beyond what was asked - solve the stated problem, then propose further work rather than doing it unprompted.
