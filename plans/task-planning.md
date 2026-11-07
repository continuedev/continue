# Task planning

Last updated: 2026-11-07. Status: P1 and P3 built (the task list as session state, `TaskList` in the CLI and `task_list` in the IDE, the list at the tail of each request, both summary prompts, the IDE list above the input) plus the CLI progress strip from P2, and P4 (plan files with a Build step). Open questions 1 to 5 are decided in [Decisions](#decisions); P0's live Bedrock measurement was replaced by a deterministic test.

Keep a plan and a task checklist outside the conversation, so a long piece of work does not lose its place when the conversation is compacted, pruned or moved to a new session.

## The problem

The CLI has a `Checklist` tool (`extensions/cli/src/tools/writeChecklist.ts`). It takes the whole list as markdown and returns it unchanged as "Task list status". Its description says "the old checklist can be seen in the chat history". So the list exists only as tool calls in the transcript.

The CLI compacts by replacing the history with one summary message (`compaction.ts`: the compacted history is the system message plus the summary, and `getHistoryForLLM` then sends only that). The summary prompt does not mention the checklist. The IDE's compaction prompt (`core/util/conversationCompaction.ts`) has an "Outstanding Work" section, but a model decides what goes in it. Either way, a ten-step plan can come back as a paragraph, with the step the model was on missing or wrong.

Pruning (`compileChatMessages` in `core/llm/countTokens.ts`) drops the oldest messages first, with the same effect. A new session, which the cold-cache notice offers as a way to avoid paying again for a long history, starts with nothing.

The IDE has no task list tool at all. I searched `core`, `gui` and the VS Code extension for todo and task-list tools and found none.

## What other harnesses do

Read from each tool's docs on 2026-11-03. "Not found" means the page was not in what was fetched, not that the feature is missing.

Three ideas recur:

1. The list lives outside the transcript and is put back in front of the model. Roo does it on every request; Claude Code does it for the plan after compaction.
2. The plan is a file the person can read and edit, not a chat message.
3. Work moves to a fresh context on purpose (`/newtask`, Roo subtasks, Cursor Projects), carrying the plan and not the whole history.

### Roo Code

`update_todo_list`, three states (pending, in progress, completed). Created automatically for complex tasks and always in Architect mode, or on request. Shown in the task header (compact) and in the chat (editable). When an update is awaiting approval you can edit, add, remove or re-status items; your edits are applied at Roo's next update, so Roo keeps control of the list.

The list also appears on every request as a "REMINDERS" table in the environment details, "giving the AI persistent access to current todo state". Two settings: require a list when creating subtasks (`newTaskRequireTodos`) and block completion while items are open (`preventCompletionWithOpenTodos`), both off by default.

Orchestrator mode splits work into subtasks that each run in their own conversation. "Down" is the instructions given at creation, "up" is the final summary, and only that summary returns to the parent.

The condensing page does not mention how todos are treated.

### Gemini CLI

`write_todos` with five states: pending, in progress, completed, cancelled, blocked. Only one item may be in progress. The progress appears above the input prompt and Ctrl+T toggles the full list. State is scoped to the session.

### OpenCode

`todowrite` is a built-in tool with its own permission entry. It is off by default for the General subagent. The page fetched does not say more.

### Claude Code

A to-do checklist in the status area, toggled with Ctrl+T; `/tasks` is a different view (running shells and subagents). Plan mode writes a plan, and the context-window page says the plan "is re-injected from disk" after compaction. Whether the checklist survives compaction is not stated in what was fetched.

### Cline

The docs suggest asking for a todo list during planning to track in Act mode. A dedicated "Focus Chain" page was not found: two guessed URLs gave 404 or an unrelated page.

`/deep-planning` has four steps: investigate silently, discuss, write `implementation_plan.md`, then create a new task with trackable steps. `/newtask` packages "overall plan, work accomplished, relevant files, next steps" into a fresh task. `/smol` compresses the current one.

### Cursor

The pages fetched do not describe a to-do checklist. The behavior you described comes from using it, and I could not confirm how it persists. What the docs do say:

- Plan Mode asks clarifying questions, researches the codebase, writes a plan you edit as markdown, and builds on a click. Plans save to your home directory by default; "Save to workspace" moves one into the repository.
- `/goal` gives the agent a long-lived objective.
- A Project has a coordinator that plans and delegates to other agents. It keeps files that sync across every machine its agents use, so what one agent learns the next can use.
- Messages can be queued or sent to steer a running turn.

## Design

### What to take

| Idea                                                               | From                 | Take it?                                                                                                             |
| ------------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| The list is state in the session, not tool calls in the transcript | Roo (reminders)      | Yes. This is the core change.                                                                                        |
| The model gets the current list on every request                   | Roo                  | Yes, as a short block. See "Where the list goes in the request".                                                     |
| Item states with a single in-progress item                         | Gemini CLI           | Yes: pending, in progress, completed, cancelled, blocked. Without the rule the list stops showing where the work is. |
| The person can edit the list                                       | Roo                  | Yes. Roo defers your edits to its next update so the model stays in charge; open question 2 asks which way to go.    |
| A plan file the person can read and edit                           | Cursor, Claude Code  | Yes: `.continue/plans/<name>.md` in the workspace.                                                                   |
| Plan re-injected after compaction                                  | Claude Code          | Yes. It follows from the list being separate state.                                                                  |
| Carry the plan into a new session                                  | Cline `/newtask`     | Yes, as "New session with this plan", offered by the cold-cache notice and by compaction.                            |
| Block finishing while items are open                               | Roo                  | Opt-in only, off by default, as in Roo.                                                                              |
| Subtasks with their own conversation                               | Roo, Cursor Projects | Later. Needs subagents out of beta and the permission fix (E1).                                                      |
| A long-lived goal                                                  | Cursor `/goal`       | Not now.                                                                                                             |

### Shape

One structure shared by core, the CLI and the IDE:

```ts
type TaskStatus =
  "pending" | "in_progress" | "completed" | "cancelled" | "blocked";

interface TaskItem {
  id: string; // stable, so a person's edit and a model update meet
  text: string;
  status: TaskStatus;
  note?: string; // why blocked or cancelled
}

interface TaskPlan {
  items: TaskItem[];
  planFile?: string; // path of the plan file, if the work has one
  updatedAt: string;
}
```

`Session` gets an optional `taskPlan`. Sessions saved before this have none, which means no list, as today.

### Tools

- `TaskList` replaces `Checklist`. It takes the complete list, as `Checklist` does, with `id` optional on new items. Taking the whole list keeps the model's habit and avoids merge rules. The tool validates (at most one in-progress item, no empty text), stores the list in the session, and returns a short confirmation instead of echoing the list.
- `Checklist` stays as an alias that maps its markdown form onto `TaskList`, so existing prompts and rules keep working. Its default policy stays `allow`.
- No read tool: the list is already in the request.

### Where the list goes in the request

The list changes every few turns, so it must not sit in the stable prefix that the prompt cache keys on. What the code does today:

- IDE: `constructMessages.ts` already appends the compaction summary to the system message as "Previous conversation summary". That is a precedent, but it puts changing text in the cached system message, so a change costs a rewrite of everything after the system prompt.
- CLI: `streamChatResponse.ts` rebuilds the system message on every iteration from `services.systemMessage`. The CLI has no cache marker code of its own (a search for `promptCach` and `cache_control` in `extensions/cli/src` found nothing), so how it interacts with caching depends on the shared provider code.

Proposal: add the list as the last block of the request, after the history, as a short user-role context message, so only the tail changes. That is where Roo's per-request reminders sit. Position and cost should be measured on Bedrock with the existing live cache test (a changing list at the tail versus in the system message, comparing cache reads) before this is built. Open question 1.

Keep it small: one line per item, notes only for blocked items, at most about 40 lines, with completed items beyond the last few folded into a count.

### Compaction and pruning

- Both summary prompts get one extra instruction: the task list is kept separately and re-supplied after the summary, so the summary need not restate it.
- After compaction the list block is added to the next request as usual. Nothing has to be reconstructed.
- Pruning is unchanged. The list is not in the transcript, so dropping old messages cannot lose it.
- "New session with this plan" copies `taskPlan` and the plan file path to the new session and adds a one-line note that it continues earlier work.

### Plan files

Plan mode ends by writing `.continue/plans/<slug>.md` with a title, goal, approach and steps. The steps become the first `TaskList`. The file is for people: the next time the plan is loaded, edits to it are read back.

Where it is saved is a choice. Cursor saves to the home directory by default and offers "Save to workspace". I would default to the workspace so a team can review a plan, and add a setting. In headless mode there is no one to approve, so plan mode writes the file and stops. Open question 3.

### UI

- CLI: keep `ChecklistDisplay`. Add a one-line progress strip above the prompt (`3/8 Running migrations`) and a key to expand the list. The key must not clash with existing bindings; not checked.
- IDE: a collapsible list under the input toolbar, with items editable in place.
- Both: completed items dimmed, the in-progress item highlighted.

## Safeguards

- The list is data from the model. Item text is shown as text and never run as a command or treated as an instruction when a person edits it.
- A cap on items (about 50) and on item length, so a runaway model cannot fill the request.
- A plan file read back from disk is workspace input, like a rules file. A plan file in a freshly cloned repository does not change the task list until the person opens it.
- Hooks (Track D): `TaskList` is a tool, so `PreToolUse` and `PostToolUse` hooks apply to it like any other.

## Phases

| Phase | Scope                                                                                                                                                           | Depends on |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P0    | Measure: the tail-versus-system-message experiment on Bedrock; confirm a free key for the CLI list view; read the CLI session save path. No behavior change.    | none       |
| P1    | `TaskPlan` type in core, `taskPlan` on `Session`, `TaskList` tool and `Checklist` alias in the CLI, the list block in the request, both summary prompts, tests. | P0         |
| P2    | CLI display: progress strip, expand key, editing from the keyboard, edits told to the model.                                                                    | P1         |
| P3    | IDE: `TaskList` tool in core, session field, list under the input, in-place editing, compaction.                                                                | P1         |
| P4    | Plan files: plan mode writes `.continue/plans/<slug>.md`; steps seed the list; read back on load; setting for location.                                         | P1         |
| P5    | New session with this plan, offered by the cold-cache notice (C6) and by compaction. Optional setting to block completion while items are open.                 | P1, C6     |
| P6    | Subtasks with their own conversation, carrying the plan down and a summary up. Needs subagents out of beta and the permission fix.                              | P1, E1     |

P1 fixes the stated problem and can ship alone for the CLI. P3 is the larger job: the IDE has no task tool, and its tool calls run through `gui` redux code.

## Open questions

1. Where does the list go in the request: at the tail, or inside the system message beside the summary? P0 should answer it with cache numbers.
2. Who owns the list? If a person's edit applies at once, the model may overwrite it on its next whole-list update. If it waits for the model's next update, as in Roo, the model stays in control but the edit seems ignored. A third option locks items the person edited so the model cannot change them.
3. Plan files: workspace or home directory by default?
4. Should the IDE and CLI share one `TaskPlan` implementation in `core`, or should the CLI keep its own and map? Sharing is cleaner, but the CLI imports `core` through a package link that needed rebuilding by hand in this checkout.
5. How does Cursor's list survive summarization? The docs fetched do not say. If it is stored in the plan file or re-sent every turn, that settles question 1.

## Decisions

Made on 2026-11-06 while building P1 and P3. Sources read that day are listed at the end of this section.

### What the newer research changed

- Claude Code now has `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList` with stable ids, statuses and an `activeForm` label shown while an item runs; `TodoWrite` is the older whole-list tool. Its interactive-mode page says tasks "persist across context compactions". Since v2.1.268 the tools are given by default only to Opus 4.7, Sonnet 4.6, Haiku 4.5 and earlier models, because newer models keep track of multi-step work without a written list and the tool definitions and reminders cost context.
- The guidance Claude Code gives the model: use a list for work with three or more distinct steps or when the user lists several things, skip it for a single quick change. The "exactly one in progress" and "mark complete immediately" rules come from community copies of the tool prompt, not from Anthropic's docs.
- Cursor's docs still do not say how its to-dos survive summarization. Forum reports (found by search, not confirmed by the docs) say summarization can drop or garble them (question 5): that is the failure this design avoids by keeping the list outside the transcript.

We kept one whole-list tool rather than Claude Code's create/update pair: it is one call per change, needs no merge rules, and matches `Checklist`, which models already use. `activeForm` was added to the item.

### 1. Where the list goes: the tail, after the conversation's cache point

The list is a separate user message after the history (`<task_list>` … `</task_list>`), sent only when the task list tool is offered.

Bedrock (`core/llm/llms/Bedrock.ts` and `packages/openai-adapters/src/apis/Bedrock.ts`) places at most four cache points: after the tools, after the system prompt, and at the end of the last two user messages. Both merge consecutive user and tool messages into one Bedrock user message, so the list would land in the same message as the last tool result, before its cache point. The next request no longer has the list there, so the bytes before that point would differ, and the last step (an assistant message and its tool results) would be written to the cache again on every request. Both converters now recognise a trailing block that starts with `<task_list>` and put the cache point before it (and leave the per-process ID off it). Cost per request:

| Where the list sits                       | What a change to the list costs                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| System message, beside the summary        | The whole conversation after the system prompt is written again (1.25x input price)  |
| Tail, before the conversation cache point | The last step is written again on every request, list changed or not                 |
| Tail, after the cache point (built)       | Nothing beyond the list's own tokens (tens to a few hundred) at the full input price |

Tests show this without a live call: `core/llm/llms/Bedrock.test.ts` ("with the task list block at the tail") and `packages/openai-adapters/src/apis/Bedrock.taskList.vitest.ts` build two consecutive requests with different lists and check that the second starts with exactly the blocks the first cached, and a control case where untagged text loses that. Anthropic's own API needs no change: there the list stays a separate message, so the breakpoint on the real last message stays where it was. Providers with automatic prefix caching (OpenAI and others) also gain from a tail position.

In the IDE the list is kept out of the messages used for the cache-miss key and for the compaction request (`buildChatRequest` returns it as `taskListMessage`), and `compileChatMessages` sets it aside while pruning so the real last turn stays protected. A live Bedrock measurement with `Bedrock.cache.live.vitest.ts` is still worth doing once.

### 2. Who owns the list: the person's edit wins at once

An edit in the IDE list applies immediately and is saved. The plan records `updatedBy: "user"`, and the next request's block says the user edited the list and to keep their changes. Because the model gets the current list at the end of every request, its next whole-list update starts from the person's version. Roo's way (edits wait for the model's next update) makes an edit look ignored; locking edited items needs per-item merge rules that a whole-list tool does not have. One race remains: a tool call the model generated before the edit can still replace it.

Completed items the model leaves out of an update are kept, because the block folds old completed items into a count and the model cannot repeat what it does not see. Open items left out are removed. `reset: true` starts a new list. The person's edits replace the list exactly.

### 3. Plan files: in the workspace, proposed by a tool, built from a card

Built as P4 on 2026-11-07 (phase P of `agent-ux-parity.md`).

- **Where**: `.continue/plans/<slug>.md` in the workspace (the first workspace folder in the IDE, the working directory in the CLI), so a team can review a plan. Claude Code keeps plans in `~/.claude/plans/` (setting `plansDirectory`); Cursor saves to the home directory (`~/.cursor/plans/*.plan.md`) and "Save to workspace" moves a plan into `.cursor/plans`. No setting yet.
- **Format** (`core/util/planFile.ts`): a `# Title`, a short body, and a `## To-dos` checkbox list in the task list's markers, each line ending in `<!-- id: N -->` so ids survive a round trip through a file the person edits. A file a person wrote is read too: any "To-dos", "Tasks", "Steps" or "Checklist" heading, or every checkbox line when there is none. The to-dos are the task list, one to one.
- **The tool**: `present_plan` in the IDE, `PresentPlan` in the CLI, following each side's naming (`task_list` / `TaskList`). It takes `title`, `plan` (markdown) and `todos` (strings). It writes the file, replaces the task list with the to-dos, records the file on the session (`Session.planFile`, a file URI) and ends the turn. It is offered in Plan mode only. Not named `ExitPlanMode`: here the tool does not leave Plan mode, the person's Build does, and the person can keep planning. Presenting again with the same title replaces the session's own file; a file of that name from elsewhere gets `-2`.
- **Approval, IDE**: the tool call shows as a card (title, the plan rendered, the to-dos, a link that opens the file) with **Build** and **Keep planning** until something is sent after it. Build reads the file back, makes its checkboxes the task list (marked as edited by the user when they differ, so the model keeps the edits), switches to Agent mode and sends a message to implement the plan, read the file first and keep the list current. Keep planning stays in Plan mode and focuses the input. The tool's result is recorded in the history but not sent to the model (`endTurn` on a client tool), so the conversation stays well formed for the next message.
- **Approval, CLI**: the tool asks with the existing question prompt (↑/↓ and Enter): Build, Keep planning, or type what to change. Build reads the file back the same way, switches the permission mode to normal and returns the build instructions as the tool result, so the same turn continues with the write tools. Headless runs have nobody to approve: the plan is saved, `Plan saved to <path>` goes to stderr, and the model is told to stop and end with the path.
- **No "Build, auto-approve edits"**. Claude Code's approval offers auto mode or accept-edits. Here neither maps cleanly. In the IDE the approval mode is a global setting, not per session, and edit tools are always reviewed as diffs whatever it says, so a per-plan "auto-approve edits" would silently change a global setting without changing how edits are reviewed. In the CLI, `auto` allows every tool including Bash and MCP, which is more than edits. The person can switch modes after Build as usual.
- **Plan mode no longer runs Bash or MCP tools unasked in the CLI**: `PLAN_MODE_POLICIES` had `Bash: allow` and `*: allow`. They are now `ask`; in headless plan mode "ask" tools are not offered, so a headless plan run is read-only. The IDE's Plan mode still offers MCP tools under their own policies (not changed here).

### 4. One implementation in core

`core/util/taskPlan.ts` holds validation (at most one item in progress, at most 50 items, 200 characters per item, unique ids), id assignment, the request block, the progress line, the confirmation and the markdown mapping for `Checklist`; the types are in `core/index.d.ts` and `Session.taskPlan` is saved by `core/util/history.ts`, which the CLI also uses. The CLI imports it like its other core imports, through `core/dist`, so `npm run build` in `core` is needed before the CLI type-checks. `packages/openai-adapters` cannot import core, so it keeps its own copy of the tag, and a core test checks the two match.

### Sources

- Claude Code task tools and model availability: https://code.claude.com/docs/en/tools-reference (Task tool availability), https://code.claude.com/docs/en/agent-sdk/todo-tracking
- Claude Code task list display and compaction: https://code.claude.com/docs/en/interactive-mode (Task list)
- Tool prompt wording (unofficial copies): https://tangled.org/nonbinary.computer/claude-code/blob/main/tools/TodoWriteTool/prompt.ts, https://spring-ai-community.github.io/spring-ai-agent-utils/latest/tools/TodoWriteTool/
- Claude Code plan mode and its approval options: https://code.claude.com/docs/en/permission-modes, https://code.claude.com/docs/en/tools-reference (`ExitPlanMode`: "Presents a plan for approval and exits plan mode", permission required)
- Cursor plan mode: https://cursor.com/docs/agent/planning, https://cursor.com/blog/plan-mode; plan storage and Build (forum, staff replies): https://forum.cursor.com/t/plan-files-stay-with-an-active-build-button-after-work-is-already-shipped/166085, https://forum.cursor.com/t/customize-build-plan-mode-message/144229
- Cursor to-dos and summarization (forum reports): https://forum.cursor.com/t/agent-stuck-referencing-stale-completed-plans/160672, https://forum.cursor.com/t/agents-doing-weird-things-since-mon-tues-9-10th/154517, https://forum.cursor.com/t/cursor-1-2-agent-planning-better-context-and-faster-tab/112236

## Not decided here

- Whether to show the plan in a side panel instead of under the input.
- Automatic creation of a list for a complex request without the model asking for one. Roo does this; it is a prompt change that can follow once the list is reliable.
