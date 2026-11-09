# Context visibility: what is in the prompt, what it costs, and what is wasted

Written 2026-11-09. Roadmap: Track J in [`ROADMAP.md`](./ROADMAP.md). Builds on the usage display (`usage-display.md`, #182), the cache ledger and notices (`cache-safeguards.md`, #261 to #264), the CLI's processed-input accounting and request dump (#356), and the prompt-prefix findings of 2026-11-08 (`audit-bedrock-caching.md`, `research-local-caching.md` in the session notes).

## 1. Problem

The usage indicator shows one number: how full the context window is, with session cost beside it. It does not say what the prompt is made of, which parts are the same every request (and so cacheable), which parts changed since the last request, or what a person could remove. Claude Code's `/context` shows a breakdown by category (system prompt, system tools, MCP tools, memory files, messages, free space) and the token count of each, which is how people learn that an idle MCP server costs them thousands of tokens a request. We have the data in the request builder and the usage fields; nothing shows it.

The waste we measured in one day: tool definitions for an MCP server nobody called in a session (schema tokens on every request); a task list resent unchanged 24 to 107 times; a per-process marker that rewrote the whole prefix on every resume; a date and a git status inside the cached system text; a prompt under the provider's cache minimum with nothing to say so; reasoning tokens spent on a two-token answer; a 4.5M-token retry loop on a tool call the provider truncated; fallback-priced totals two to six times the real bill.

## 2. Design

### 2.1 The breakdown

A `contextBreakdown(request)` function in core takes the compiled request (messages, tools, system) and returns sections with token counts, using the existing tokenizer:

| Section            | Parts                                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System prompt      | the base text, the turn text (plan or act, which profile), rules by source file, instruction files (AGENTS.md and friends) by file, the code-block rules                                                         |
| Tools              | built-in tools by group; each MCP server's tools; skills; the task list and plan tools; per tool: name, schema tokens, calls this session, last call                                                             |
| Blocks on messages | the task list block, the environment block, steering messages, nudges, held-question results                                                                                                                     |
| Conversation       | user messages, assistant text, reasoning, tool results by tool (and the largest single results), images and attachments                                                                                          |
| Cache              | the part of the prompt that was the same as the last request (the cached prefix), the part that changed, and why it changed when known (mode switch, tool list change, rules rebuild, effort switch, compaction) |
| Totals             | input, output, cache read, cache write, processed input; the model's window and headroom; cost at list price or marked as an estimate                                                                            |

The function is pure and lives next to `compileChatMessages` so the IDE, the CLI and `cn serve` get the same numbers.

### 2.2 Surfaces

- **CLI**: a `/context` command prints the table for the last request, with the five largest items and the warnings (2.3). `cn serve` adds `context` to `/state` (the same object).
- **IDE**: the usage indicator opens a panel: a stacked bar of the sections for the last request, a trend over the session (processed input per request, cache read share), the "what changed since last request" line, and the warnings with their suggested action as a button where one exists (disable a tool group for this mode, switch off an MCP server, open the rule file, start a new session).
- **Both**: Copy context record, the way the cache ledger has Copy cache record, for bug reports and for the benchmark's accounting column.

### 2.3 Waste warnings

Each warning has a trigger that comes from the breakdown or the session, a one-line explanation with the number that matters, and an action. They are advisory, shown once per session unless the trigger grows, and switchable off.

| Warning                        | Trigger                                                                                                        | Suggested action                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Unused tools                   | a tool group or MCP server's schemas exceed N tokens and no tool from it was called in the last K requests     | disable the group for this mode; disconnect or make the server read-only; per-mode tool sets                              |
| Idle MCP server                | a connected server whose tools were never called this session                                                  | disconnect for the session                                                                                                |
| Oversized instructions         | rules plus instruction files above a share of the window, or a rule file that never matched                    | open the file; trim; move to a prompt file                                                                                |
| Prefix churn                   | the cached prefix changed between consecutive requests, with the cause                                         | the cause itself: keep one effort across turns, finish editing AGENTS.md before continuing, do not switch models mid-task |
| Under the cache minimum        | the prompt is shorter than the provider's minimum cacheable size, so nothing can be cached                     | add the instructions file, or accept it                                                                                   |
| Resent task list               | the task list tool called with an unchanged list (the repeat guard counts these)                               | none for the person; a prompt or model problem, reported for the benchmark                                                |
| Large tool results             | a single tool result above N tokens, or the same file read more than twice                                     | read a range; pin the file as context instead of re-reading                                                               |
| Reasoning on trivial requests  | reasoning tokens above a share of output on short requests (titles, tab completion, one-line answers)          | effort none for those uses; the per-use model configuration                                                               |
| Truncated replies              | `finish_reason: length` more than once                                                                         | raise maxTokens, or lower the effort for reasoning models where reasoning counts against it                               |
| Repeated or invalid calls      | the repeat guard refused calls, or a round of invalid tool arguments                                           | reported; a model or provider problem (the truncated stream case)                                                         |
| Expensive model for cheap work | a loop item or a subagent runs on a model priced above a threshold while a cheaper model is configured         | set `modeModels.loop` or `modeModels.subagent`                                                                            |
| Estimated cost                 | totals built on the fallback rate                                                                              | add the model's price; the provider's rate card where an API has one                                                      |
| Long session, new task         | the conversation is most of the window and the latest request names a different file set than the earlier ones | start a new session with the plan                                                                                         |
| Compaction churn               | compaction ran more than twice in one task                                                                     | smaller reads; a larger window or model; check the compaction thresholds                                                  |

### 2.4 What is not in scope

- Changing behaviour automatically. Every warning suggests; the person acts.
- Provider-side context editing or tool-result clearing (noted in `cache-safeguards.md`).
- Attributing cost per rule or per tool to the cent; token counts are enough to decide what to cut.

## 3. PRs

| PR  | Scope                                                                                                                                                                              | Depends on |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| J0  | `contextBreakdown` in core with tests on compiled requests; the CLI `/context` command and `cn serve` `/state.context`                                                             | none       |
| J1  | The IDE panel from the usage indicator: sections bar, trend, what changed, copy record                                                                                             | J0         |
| J2  | Warnings: unused tools, idle MCP server, oversized instructions, prefix churn, under the minimum, truncated replies, estimated cost (the ones the data already supports)           | J0         |
| J3  | Warnings that need new counters: large tool results and repeated reads, reasoning share on short requests, expensive model for cheap work, long session new task, compaction churn | J2         |
| J4  | Per-mode tool sets and a one-click "disable for this mode", the action most warnings point at                                                                                      | J2         |
| J5  | The benchmark's accounting column reads the context record (Track I)                                                                                                               | J0         |

## 4. Tests

Unit tests on `contextBreakdown` with fixed compiled requests (sections sum to the total; each warning's trigger fires and does not fire on constructed cases); CLI `/context` rendering; the IDE panel in jsdom; the serve `/state.context` shape. Live: one Bedrock Claude and one Strata session compared against the provider's own usage.
