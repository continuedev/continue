# Loop mode

Last updated: 2026-11-07. Status: L1 (core state machine) and L2 (IDE, with autonomy levels) built, with unit and gui integration tests. Five sandbox runs on a local model are reported in the PR. L3 (CLI and `cn serve`) and L4 (parallel items, verification) are not built.

Build a plan item by item without the person driving each step. Questions go to an inbox the person can answer while the work continues.

## The problem

Driving an agent through a plan with instructions (`.clinerules`, a long AGENTS.md that describes a process) does not work well. The model gets caught up in the process. Each turn it re-derives what comes next, re-reads the rules, and spends its effort on the process instead of the work. When it needs a decision, it either stops and waits, which stalls everything, or decides silently.

A "Multi Project mode" with a project registry and per-project sessions was proposed and set aside. Inventing a project format or new plan persistence is too specific for a general extension.

What is wanted is a loop run by the extension, not described to the model. The model gets one item at a time with a short contract. It can hold a question without stopping, and the person can answer at any time while the loop goes on.

## What other harnesses do

A research pass on 2026-11-07 read each tool's docs, repositories and papers. The notes, with every URL, are summarised here. **UNVERIFIED** marks a claim that came only from a search snippet or a secondary page.

The questions asked of each harness:

1. Who picks the next item?
2. Can it ask the person something without blocking other work?
3. When does it re-plan?
4. What stops it?
5. What budgets apply?

| Harness                    | Who picks the next item                                                                  | Non-blocking questions                                                                                   | Re-plan                                                                                    | Stop                                                                                                  | Budgets                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Claude Code `/loop`        | The model, within a fixed priority list (unfinished work, then the PR, then cleanup)     | No                                                                                                       | Every iteration                                                                            | The model stops; a fallback wakeup about 20 minutes later ends a silent loop; 7-day expiry            | Expiry only                                                                   |
| Claude Code `/goal`        | The model                                                                                | No                                                                                                       | Every turn                                                                                 | A separate small model judges the condition after each turn; "no tool use for several turns" stops it | Turn or time limits written into the condition                                |
| Claude Code agent teams    | A teammate claims "the next unassigned, unblocked task"; the harness unblocks dependents | Permission prompts from background subagents surface in the main session; subagents cannot ask questions | By the lead                                                                                | `TaskCompleted` hooks can veto completion                                                             | 3 to 5 teammates recommended                                                  |
| Claude Code headless       | The model                                                                                | `--permission-prompts none` removes questions                                                            | —                                                                                          | `--max-turns`                                                                                         | `--max-budget-usd` ("spend can pass the cap")                                 |
| Claude Code auto mode      | —                                                                                        | A blocked action is skipped in `-p` runs                                                                 | —                                                                                          | Pauses after 3 blocks in a row or 20 in total                                                         | —                                                                             |
| Cline Plan/Act             | The model                                                                                | `ask_followup_question` blocks                                                                           | The person switches back to Plan                                                           | `attempt_completion`                                                                                  | Not documented on the fetched pages (UNVERIFIED)                              |
| Roo Code Orchestrator      | The orchestrator model, after each subtask result                                        | No; the parent is paused while a subtask runs. A follow-up question can proceed on a timer               | After each subtask                                                                         | `attempt_completion`                                                                                  | "Max Requests" (consecutive API calls)                                        |
| Kiro specs and Task Runner | The harness: a dependency graph run in waves, then the first pending task                | Only steps marked `force_approval` wait, even in YOLO mode                                               | After 3 failed attempts (up to 2 re-plans per step), or when the spec changes (Sync Files) | All steps pass; re-plans exhausted; 50-task cap                                                       | Retries, re-plans, task cap, stall warning at 60 minutes and reset at 2 hours |
| OpenHands                  | The model (one ReAct loop)                                                               | No                                                                                                       | Every step                                                                                 | Finish action; a stuck detector; max iterations                                                       | Iterations and USD (defaults UNVERIFIED)                                      |
| Devin                      | The model                                                                                | Not documented; a session waiting for the user waits as a whole                                          | UNVERIFIED                                                                                 | Finished, suspended, the person                                                                       | Usage caps; no usage while waiting                                            |
| Codex cloud                | The model, one task per workspace                                                        | Parallel tasks are independent; questions inside a task UNVERIFIED                                       | UNVERIFIED                                                                                 | Task completion                                                                                       | UNVERIFIED                                                                    |
| Cursor cloud agents        | The model, each agent on its own branch                                                  | UNVERIFIED                                                                                               | UNVERIFIED                                                                                 | Completion                                                                                            | A spend limit                                                                 |
| Aider                      | The person                                                                               | No                                                                                                       | The person                                                                                 | After each request                                                                                    | None documented                                                               |

### Patterns from the papers

- **ReAct** interleaves reasoning and acting, so it re-plans implicitly at every step.
- **Plan-and-Execute** (LangChain) runs a re-plan prompt after execution that either answers or emits a new plan.
- **LLMCompiler** has the planner write a task DAG. A fetching unit "needs only a fetching and queuing mechanism, not a dedicated LLM" to dispatch ready tasks. A joiner model decides whether to finish or re-plan.
- **ADaPT** decomposes an item only when the executor fails at it.
- **Reflexion** keeps a short verbal note of what went wrong for the next trial.
- **BabyAGI** re-prioritises its whole list every cycle in an infinite loop with no stop condition. It is the standard example of a runaway loop.
- **MAST** classified 1,642 failed multi-agent traces:

  | Failure mode                                  | Share of traces    |
  | --------------------------------------------- | ------------------ |
  | Step repetition                               | 15.7%              |
  | Unaware of termination conditions             | 12.4%              |
  | Incorrect, missing or incomplete verification | about 17% together |
  | Failing to ask for clarification              | 6.8%               |

### Stalls and runaway loops

OpenHands' stuck detector is on by default. It compares calls by tool name and arguments, ignoring call ids, and counts parallel calls in one response as one attempt:

| Pattern                                   | Threshold        |
| ----------------------------------------- | ---------------- |
| Same call with the same result            | 4 or more        |
| Same call ending in an error              | 3 or more        |
| Agent messages in a row with no tool call | 3 or more        |
| Two calls alternating                     | 6 or more cycles |

Kiro marks a step "Loop detected" after the same error three times. Claude Code overrides a Stop hook after it blocks eight times in a row. Its best-practices page says to clear the context after two failed corrections rather than try a third.

### How often to ask

- **Ambig-SWE** (ICLR 2026) found that asking can raise success by up to 74% on underspecified SWE-bench tasks. Models still "struggle to distinguish between well-specified and underspecified instructions", and unwarranted assumptions lead to worse outcomes.
- **Ask or Assume?** (2026) got better calibration by giving underspecification detection to a separate role from the coder. It asks little on simple tasks and early on complex ones.
- **LHAW** (2026) sorts missing information into outcome-critical, divergent and benign. Not every gap is worth a question. Over-clarification and compound questions are failure modes (UNVERIFIED).
- **MAST** counts failing to ask in 6.8% of failed traces.

The harnesses ask early, then assume during the run:

- **Kiro** analyses requirements before design.
- **Claude Code** suggests "interview me until you could write the spec".
- **Roo** shows 2 to 4 suggested answers with an optional countdown.
- **Claude Code**'s optional `askUserQuestionTimeout` submits the current selection. The model is told the person may be away and can re-ask later.
- **Devin** reportedly proceeds with a plan after 30 seconds unless told to wait (UNVERIFIED).

None of the harnesses records an assumption as something the person can confirm or overrule later. No harness verified here has a first-class "assumption ledger".

### The Ralph loop

Added on 2026-11-07 after a suggestion to look at it. Sources: Geoffrey Huntley's post (https://ghuntley.com/ralph/), his playbook repository (https://github.com/ghuntley/how-to-ralph-wiggum: `PROMPT_build.md`, `PROMPT_plan.md`, `AGENTS.md`, `loop.sh`), and the `ralph-loop` plugin in https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop (its README and `hooks/stop-hook.sh`).

In its plainest form Ralph is a shell loop that feeds the same prompt file to a headless agent forever (`while :; do cat PROMPT.md | claude ; done`). Each iteration is a fresh process, so a fresh context. Everything that carries over is on disk:

- the specs;
- `IMPLEMENTATION_PLAN.md` (earlier `fix_plan.md`), a prioritised list the agent keeps current;
- `AGENTS.md`, kept short and "operational only": how to build and test, and what was learned about running the project.

The five questions:

1. **Who picks the next item:** the model, "choose the most important item", one item per iteration.
2. **Non-blocking questions:** none. The playbook runs with `--dangerously-skip-permissions`, so a sandbox is the only boundary.
3. **Re-plan:** a separate planning prompt (`./loop.sh plan`) compares the specs with the code and rewrites the plan without implementing anything. "The plan is disposable": regenerate it when the loop goes off track, the plan is stale, or nobody is sure what is done.
4. **Stop:** the operator, `max_iterations` in `loop.sh`, or the plugin's exact `<promise>` string. The plugin's README notes that one string cannot tell "SUCCESS" from "BLOCKED".
5. **Budgets:** iterations only.

The plugin runs the loop inside one session: a Stop hook blocks the exit and feeds the same prompt back. A secondhand report says Huntley advised against it because it keeps every iteration in one context window (UNVERIFIED; from a Reddit summary).

What the playbook's prompts insist on:

- "don't assume not implemented": search before adding. A search that misses existing code, and then a duplicate implementation, is what the post calls Ralph's "Achilles' heel".
- No placeholders or stubs.
- **Backpressure:** run the tests, type checks and lints for the unit changed before committing. `AGENTS.md` names the exact commands, so the prompt can say "run the tests" generically.
- Record learnings so later iterations do not repeat mistakes, keeping them brief: a bloated file "pollutes every future loop's context".
- The operator tunes the loop by adding "signs", short instructions that every later iteration sees, when Ralph fails in a particular way.

## Design

### What the research changed

| Brief                                       | Research                                                                                                                                                                                                                                                                        | Built                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The extension picks the next unblocked item | Supported. The systems that schedule in the harness (LLMCompiler, Kiro, agent teams) behave. BabyAGI, which lets the model re-prioritise each cycle, runs away                                                                                                                  | As briefed. Ties go by plan order, and only the re-plan turn changes the order                                                  |
| "Say when it's done"                        | A turn should end with a structured result, and no result must not count as done (Anthropic's long-running harness, `/goal`, agent teams' status lag)                                                                                                                           | A `finish_item` tool with outcome done, waiting or stuck. A turn that ends without it runs the item again, then marks it failed |
| Independent items as parallel subagents     | Cognition: parallel agents make conflicting hidden decisions. Agent teams: two agents on one file overwrite each other. Anthropic's multi-agent research post: about 4x the tokens of chat for one agent, about 15x for multi-agent. Claude Code subagents cannot ask questions | Not built. Items run one at a time (phase L4)                                                                                   |
| Stop on no progress                         | Cheap counters per item work (OpenHands, Kiro)                                                                                                                                                                                                                                  | Rounds that finish nothing stop the loop. A call repeated 4 times in one item's run is refused                                  |
| Verification                                | Done should be confirmed by something other than the worker: about 17% of failed traces in MAST                                                                                                                                                                                 | Not built (phase L4)                                                                                                            |
| Assumption questions                        | No harness records them for later. Overruling should redo the work                                                                                                                                                                                                              | Assumptions are recorded. Overruling one on a done item reopens it as redo                                                      |
| Reload                                      | Kiro reopens an interrupted run paused                                                                                                                                                                                                                                          | A loop saved mid-run comes back stopped, with the item pending                                                                  |

### What the Ralph loop changed

| Ralph                                                                            | Built here                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A fresh context every iteration, with state on disk                              | Each item run and re-plan is sent without the turns before it (`freshContext`, on by default). The chat still shows every turn. What carries over: the plan file, the loop's notes, the person's answers and standing instructions |
| `AGENTS.md` learnings, kept brief                                                | `finish_item` takes optional `notes` ("a command that works, a trap you hit"). The last 12, at most 300 characters each, go with every later item and with the re-plan                                                             |
| "Don't assume not implemented"                                                   | The contract says to search before adding anything and not to conclude something is missing from one search. The re-plan prompt says the plan may be wrong and to check open items against the code                                |
| No placeholders; backpressure from tests, type checks and lints                  | The contract says to implement fully and to run the project's checks for what changed before reporting done, naming them in the summary. A check the harness runs itself is still L4                                               |
| "Signs" the operator adds                                                        | A note in the inbox can be marked **For every item**. It goes with every item prompt from then on instead of waiting for the re-plan, and the inbox lists the ones in force                                                        |
| The plan is disposable                                                           | Already the re-plan turn and "Re-plan now"                                                                                                                                                                                         |
| Model picks the item; `--dangerously-skip-permissions`; one exact promise string | Not taken. The extension picks the item, a call that would ask is held as a question, and `finish_item` reports done, waiting or stuck                                                                                             |
| A commit per item                                                                | Not taken for now: committing is outward-facing, and checkpoints (#185) already give per-turn restore                                                                                                                              |

### Shape

All of the logic is in `core/util/loopMode.ts`: pure functions, no I/O. The gui applies their results. The CLI can use the same functions later.

The loop state is `Session.loop` (`LoopState` in `core/index.d.ts`), saved with the session like the task list and the queue. The task list (`Session.taskPlan`, #306) is still the list of items. The loop keeps its own status for each item, by task id, and writes it back to the list:

| Loop status   | Task list status               |
| ------------- | ------------------------------ |
| running       | in_progress                    |
| done          | completed                      |
| waiting       | blocked ("Waiting on you: q2") |
| failed        | blocked ("Failed: …")          |
| pending, redo | pending                        |

No new file formats: the plan is the existing plan file (`present_plan`, #308) and its to-dos.

### Entry

The plan card gets a third button, **Build in a loop**, next to Build and Keep planning. It reads the plan file back, because the person may have edited it, makes its to-dos the task list, creates the loop, and switches to Agent mode.

### Act

When nothing is running (no stream, no tool call in flight, no message of the person's about to go), `useLoopDriver` calls `advanceLoop`:

1. **Finish what ran.** Record the item's report: done, waiting, stuck, or nothing.
2. **Decide** (`decideNext`), in this order:
   1. Budgets.
   2. A plan-wide answer that asked to re-plan now.
   3. The first runnable item in plan order.
   4. Done.
   5. Wait.
   6. Re-plan.
3. **Start** the item's run in the session: an ordinary user turn in Agent mode with the item prompt.

The item prompt (`loopItemPrompt`) contains:

- the item;
- the plan file's path;
- the person's answers that belong to this item;
- the person's standing instructions and the notes earlier runs left;
- whether this is a redo or a repeat attempt;
- the contract: search before adding, implement fully, run the checks before reporting, report with `finish_item`, and ask with `hold_question`.

It never explains the loop or asks the model what comes next. A unit test checks that it does not mention a next item or the loop.

**Fresh context.** The run's request starts at its own prompt (`buildChatRequest` slices the history at `LoopState.current.historyIndex`). The system message and tools stay the same, so that part of the prompt cache still hits. The conversation part starts over with each item, which is the point: the item does not pay for, or get confused by, every earlier item's tool output. What it needs from earlier work is in the files, the plan, the notes and the answers. `freshContext: false` keeps the old behaviour, one growing conversation.

While an item runs, the model is offered `hold_question` and `finish_item` and not the task list tool, because the loop owns the list. `finish_item` records the report and ends the turn without another model request.

### Questions

`hold_question(question, kind, assumption?)` puts a question in the inbox and returns at once. The item is the running one, so the model does not name it.

- **assumption** (the default the prompt recommends): the item goes on with the stated default. The question stays open; the person can confirm it ("Keep the default") or overrule it.
- **blocking**: only when there is no reasonable default. The item does what it can, then reports `waiting`. It is parked while other items run.

The contract asks the model to surface decisions instead of settling them silently: a choice between approaches, scope, naming, an irreversible step, or anything the plan does not settle. It recommends assumption first, and blocking only when there is no reasonable default. Each question must stand on its own (the item, the options, the default), so the person can answer from the inbox without reading the transcript. A unit test checks that the prompt says all of this.

**Question fatigue** pulls the other way. The research found models bad at telling when to ask, and both over-asking and silent assumptions are failure modes. So the prompt pushes towards asking, the assumption kind makes asking free for the loop, and caps keep the inbox readable:

- at most 4 open questions per item, after which the model is told to continue on its assumptions or report waiting;
- at most 40 in a loop;
- the same open question asked again is not added twice.

The inbox lists open questions together, not one notification each.

### Approvals

A tool call that would wait for approval would stall the loop. Under the loop, in `applyLoopHolds` (`gui/src/redux/thunks/loopHolds.ts`), such a call is not run:

- It becomes an approval question, which counts as blocking, and the model is told to do what it can and report waiting.
- "Allow once" in the inbox grants that exact call (tool name plus arguments) once, and the item runs again.
- During a re-plan, which only reads, such a call is refused outright.

The rules, protected paths and Auto's reviewer still decide first. Only what they leave for the person is held.

### Answers are routed by the item's state

`answerLoop` decides where an answer goes when it is given:

| Item state                      | Route              | What happens                                                                                                                                                                                                               |
| ------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| waiting (or failed)             | requeue            | The item is pending again, and its next run's prompt carries the answer. If another blocking question of the item is still open, it stays waiting.                                                                         |
| pending                         | next-run           | The answer goes with its run                                                                                                                                                                                               |
| running                         | steer              | Queued as a steered message (#303) tagged with the answer's id, delivered at the next tool boundary in the same run. If the run ends first, the answer goes with the next run, and an item that finished anyway is redone. |
| done                            | redo, or confirmed | Confirming an assumption changes nothing; anything else reopens the item as redo                                                                                                                                           |
| no item (a note about the plan) | replan             | Read at the next re-plan, or at once when marked "Re-plan now" (after the running item ends)                                                                                                                               |
| no item, marked For every item  | standing           | Sent with every item prompt from then on, like Ralph's "signs"; it does not wait for a re-plan and does not resume a paused loop                                                                                           |

Answers are stored on the loop, so several can be given at once and each is routed on its own. They persist across reloads with the session. A steered answer's queued message is never sent as a turn of its own: the turn-end send skips it. On reload the message is dropped, and the loop's record of the answer gives it to the item's next run.

### Re-evaluate

When nothing can run, some items are not done, and not every open item waits on the person, the loop re-plans. It sends one turn in Plan mode, whose tool filter (#309) keeps it read-only. The prompt carries:

- each item's status and summary;
- the notes the runs left;
- the questions items wait on;
- the person's notes about the plan;
- the assumptions not yet confirmed.

The model presents the updated plan with `present_plan` under the same title. Finished to-dos kept word for word keep their ids and stay done. The plan card then shows **Continue the loop**, which reads the file again (the person may edit it first) and starts the next round. Whether a re-plan starts the next round without the person depends on the loop's autonomy level (below). The inbox says why one is waiting on its card.

### Stop

The loop stops when:

- every item is done and no note about the plan is waiting;
- it has run `maxRounds` rounds (default 5);
- its own token use reaches `maxTokens` (default 10,000,000, by autonomy level), counting output and input the provider did not read from its cache, from the session's usage when the loop started;
- it has run for `maxWallMs` (default 2 hours);
- two rounds in a row finish no item, checked before paying for another re-plan;
- three items in a row fail (`maxConsecutiveFailures`), like Claude Code auto mode pausing after 3 refusals in a row;
- a re-plan ends without presenting a plan;
- the person presses Stop (the item goes back to pending) or Stop loop (the loop stops after the running item).

When every open item waits on the person, the loop pauses instead. An answer resumes it. An unattended loop stops waiting after 15 minutes (below).

Resume restarts the budgets from that moment.

### Limits that must not get in the way of the work

The first sandbox runs hit these, so they are recorded here:

- **The token budget counts new work.** Each request re-sends the conversation, and counting whole prompts charges the same text again every time. In one run, 3.3M prompt tokens were 94% cached: about 250k tokens of real work read as 3.35M, and the loop stopped itself after one item. The budget is a guard against a runaway, not a target, so its defaults are also larger.
- **One item's run has a limit of 60 model requests.** Past it, tools that only read are refused, and the model is told to write what it has and report. Writing goes on, because a run that has done its research must still be able to produce the result. If it keeps going for 10 more requests the run ends as stuck.
- **A tool call cut off at the output limit is not run.** The lenient argument parser repairs a truncated object into a valid-looking one, so `create_new_file` would write part of the file and report success. A call that stops inside a string or an open value is refused, this applies outside the loop too, and the model is told to write in smaller pieces (`core/util/truncatedJson.ts`).
- **Large files are written in parts.** `create_new_file` takes `append`, and its description says to write a long file in parts. A larger limit alone is not enough: a cut-off call throws away the whole generation, Aider's 2024 benchmark found models write worse code inside JSON, and one tool author reports that steering the model saves tokens where blocking oversized writes does not. Automatic retry with a higher limit and repairing truncated arguments were rejected: the first regenerates everything, and the second is the bug that wrote partial files.
- **Output limit on local models.** A local model with no configured limit is asked for the room its context has left, up to 131,072 tokens (`core/llm/outputLimit.ts`). A truncated file edit is expensive and asking for more costs a local server nothing: the IDE's pruning reserves a fixed 1,000 tokens for the reply whatever `maxTokens` says, so a large limit does not take room from the conversation. The ceiling is only there to end a model that has started repeating itself. A limit set in the model's config (`defaultCompletionOptions.maxTokens`) stands, and hosted providers keep their defaults, because some reject a value above their own limit. The CLI budgets differently (`contextLength - maxTokens`) and is unchanged.

### Autonomy

How much the loop does without the person is one setting with three levels. It is not a second switch next to the approval mode: the loop starts at the level the approval mode implies, so "YOLO" means one thing. The inbox has a picker to change the level while the loop runs. Changing it gives the loop that level's budgets.

|                                           | Supervised                                  | Auto                          | Unattended                                                                          |
| ----------------------------------------- | ------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| Starts from approval mode                 | Manual                                      | Auto-approve, Auto            | YOLO                                                                                |
| A re-plan starts the next round by itself | Never: the card waits for Continue the loop | When it adds no new to-dos    | When it adds at most 5 new to-dos                                                   |
| Every open item waits on the person       | Pause until an answer                       | Pause until an answer         | After 15 minutes without an answer, the waiting items go on with their best default |
| Default budgets                           | 3 rounds, 5M tokens, 1 hour                 | 5 rounds, 10M tokens, 2 hours | 10 rounds, 20M tokens, 8 hours                                                      |

Whatever the level:

- Deny rules, protected paths and ask rules decide first. A call they leave for the person is held as a question, never run. In YOLO, nothing else asks, so only those are held.
- Nothing is confirmed on the person's behalf. When an unattended wait runs out, the questions stay open in the inbox. The item's prompt names them and says to take its best default, to record it as an assumption, and to leave anything that cannot be undone. An answer that comes later is routed as usual, so a done item is redone. This follows the research: a timeout means "keep going", never "confirmed".
- The budgets, the no-progress stop, the three-failures stop and the repeat limit apply.

What this takes from the research and from Ralph:

- **Ralph** runs every iteration with permissions skipped and relies on a sandbox.
- **Claude Code** pauses auto mode after 3 refusals in a row or 20 in total.
- **Roo** has a follow-up timer that proceeds on its own.
- **Kiro**'s gated steps block even in YOLO mode.

Unattended is the hands-off level here, but it keeps the person's rules and records what it did not ask.

### Surfaces and modes

**No new `MessageModes` value.** The loop is a controller over two existing modes: item runs are Agent mode and re-plans are Plan mode. A new mode would have meant threading a value through `selectActiveTools`, ModeSelect, ToolPolicyItem, promptCache and the CLI's mode handling, and every one of those would have to treat it as Agent or Plan anyway. The smallest correct change is a session field the selectors read: `selectActiveTools` offers the loop tools while an item runs, and hides the task list tool.

The IDE is wired first. The CLI is the next phase (L3). It has its own streaming loop and tool set, so it needs:

- its own driver around `streamChatResponse`;
- `HoldQuestion` and `FinishItem` tools;
- a TUI inbox;
- for `cn serve`, `GET /state` to include the loop and `POST /message` to take `{loopAnswer: {questionId, text}}`.

The decisions and prompts come from core, so it is mostly wiring.

## Stall guidance (decided 2026-11-08, mostly not built)

The question was whether a stuck agent should get problem-solving advice, for example random cards from frameworks like 5 Whys, through a tool or a system prompt. The research behind this is summarised here; no study tests this exact intervention, so every wording is untested.

**Decision: hand the model a fact from the harness and ask for one checkable hypothesis. Then change something structural.**

| Idea                             | Decision           | Why                                                                                                                                                                  |
| -------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intervene at a stall             | Yes                | SWE-PRM (SWE-bench Verified): 40.0% base, 45.8% generic critique, 50.6% targeted diagnosis. Wink's 15-day production A/B cut tool-call failures 4.2% and tokens 5.3% |
| The harness triggers it          | Yes                | Mid-run self-assessment barely separates success from failure (AUROC about 0.5 to 0.64, Kaddour et al.)                                                              |
| A tool the model calls           | No                 | It would have to know it is stuck. Anthropic's think tool added 1.6% on SWE-bench and Anthropic now prefers extended thinking                                        |
| Named frameworks                 | No                 | No test of 5 Whys or PDCA exists; the nearest proxy, personas, shows no benefit (Zheng et al.). Their useful content is rewritten as concrete moves                  |
| Random advice                    | Only as a test arm | No support, and it discards the one thing the harness knows: which failure happened                                                                                  |
| Dictating the next command       | No                 | SWE-PRM: diagnosis plus a dictated action scored 44.8%, below diagnosis alone                                                                                        |
| Injecting without a real failure | No                 | Self-correction with no external signal hurts (Huang et al., Reflexion's ablation). "Are you sure?" makes models abandon correct answers (Sharma et al.)             |

What follows a note matters as much as the note. Two rounds capture most of the gain (Arimbur), and the best recovery numbers come from structural change: rollback with a note, decomposing on failure (ADaPT), or new information. An executable reproduction added 19 to 28 points in ORACLE-SWE, and a debugger offered after 5 failed rewrites beat none on all six debug-gym models.

**Signals and text** (full wording in the report):

| Signal                                      | Text carries                                                                                                                                      | State                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Same call 4 times with no file change       | The fact, and a request for a different check. A second refusal ends the run as stuck                                                             | Built                          |
| Same check fails twice with an edit between | The first error line, files changed, and "name the single cause you now think most likely and run the cheapest thing that would show it is wrong" | Not built; observe-only in 2.4 |
| Item retried                                | What the last run saw and changed, and "start from a different explanation"                                                                       | Not built; on in 2.4           |
| Past the turn limit                         | What has been verified so far, without a verdict                                                                                                  | Not built; on in 2.4           |
| Item reports stuck                          | A required `blocker` on `finish_item`: answer, observe, plan or environment                                                                       | Not built; on in 2.4           |
| A round finished nothing                    | Each failed item's blocker, and a reproduce-first first step                                                                                      | Not built; on in 2.4           |

**Exposure:** no tool. One setting, `loopMode.stallNotes: off | observe | on`, default `observe`, which governs only the new mid-run note. The rest replace text the loop already sends.

**Placement:** tagged `<harness-note>` user-role text after the tool results, appended once and never edited, and never in the system prompt. Refusals stay in the refused call's tool result. Qwen3.5 templates raise an error on a mid-history `system` message.

**Cap:** at most two mid-run notes per run, five requests apart, then the existing ladder. There is no third note, and no sterner one.

**Measure:** whole-task A/B cannot detect this (about 1,900 runs per arm). Replay about 30 real stuck states as paired forks in four arms: no note, a neutral placebo, the targeted note, and a random card. Add a separate test on healthy states for the cost of a false positive. If the placebo equals the targeted note, keep the shortest text. That is the result that would vindicate the random-card idea.

**Tools to add after 2.4, in order:** harness-triggered restore to the item's starting checkpoint with a note; a failure-only test runner; a second-model reviewer for local workers, never a local model judging itself; a dedicated debugger only if guidance plus the terminal measurably falls short.

## Safeguards

- The loop never starts by itself after a reload: a loop saved mid-run comes back stopped.
- Every turn the loop sends is visible in the chat, and Stop works as usual.
- Item runs keep Agent mode's permissions. A call that would ask is held, never run.
- Re-plans are read-only, and anything the rules would ask about is refused during them.
- A call repeated 4 times in one item's run is refused, and the model is told to try another way or report stuck.
- A run has a limit of 60 model requests. Past it, reading stops and writing goes on; 10 requests later the run is ended as stuck.
- A tool call cut off at the output limit is refused instead of run with partial arguments.
- A turn that ends without `finish_item` is not counted as done. After 2 such runs the item is failed.
- Caps apply to questions per item and per loop, to answer and question length, to summaries, and to the notes carried between items (12, at most 300 characters each), so the item prompt cannot bloat.
- Subagents cannot use `hold_question` or `finish_item`: they would report the parent's item.
- No autonomy level loosens the person's rules or confirms an answer for them; Unattended only stops waiting.

## Phases

- **L1 (built):** `core/util/loopMode.ts` and `core/tools/definitions/loopTools.ts`, with unit tests in `core/util/loopMode.vitest.ts`.
- **L2 (built):**
  - IDE wiring: the plan card buttons, `LoopInbox`, `useLoopDriver`, `gui/src/redux/thunks/loop.ts`, `loopHolds.ts`, the client tools, persistence and the Stop path.
  - Integration tests in `gui/src/pages/gui/chat-tests/LoopMode.test.tsx` and `gui/src/redux/slices/sessionSlice.loop.test.ts`.
- **L3:** CLI and `cn serve`, as above.
- **L4:**
  - Verification: an acceptance check per item, run by the harness before an item counts as done (a command from the plan, or a separate evaluator).
  - Parallel items as subagents, only for items the plan marks independent with disjoint files, at most 2 or 3, and ideally each in its own worktree (#314's Agents panel).
  - Checks the project names once (Ralph's `AGENTS.md` validation commands), run by the harness after each item as backpressure.

## Open questions

1. **Notes or a file?** Ralph keeps its learnings in `AGENTS.md`, where they outlive the loop and any later session reads them. Here they live on the loop, so they end with it. Should accepting the last round offer to append them to the project's rules or AGENTS.md?
2. **Dependencies between items.** To-dos have no dependency field, so "not blocked" means "not waiting on the person". Kiro and LLMCompiler schedule a DAG. A `depends:` note in the plan file would need a format change, which the brief rules out for now.
3. **Overruled assumptions downstream.** Overruling reopens only the item that made the assumption. Items built on it are not marked stale; the re-plan prompt lists unconfirmed assumptions so the model can rework them. Should a commit or push wait until the assumptions it depends on are confirmed?
4. **Budget defaults.** The budgets of each autonomy level are guesses, raised once after the sandbox runs. They are fields on `LoopState.budget` and follow the level, but there is no setting to change them yet.
5. **The 15-minute wait.** Unattended's wait is fixed. It could be a setting, or follow how long the person usually takes to answer.

## Decisions

1. **The extension runs the loop, not the model.** This is the brief, and the research supports it: harness scheduling works, and model-driven re-prioritisation runs away.
2. **No new mode, no new format.** Item runs are Agent mode and re-plans are Plan mode. Items come from the plan file and the task list. The new state is one session field.
3. **`finish_item` is the one addition to "say when it's done".** A structured report is what makes "done" checkable, and no report never counts as done. It also ends the turn without another request.
4. **Answers are routed when given, by the item's state, and kept on the loop.** A running item gets its answer by steering. The person's own messages keep the usual queue: they are sent at turn end as an ordinary turn, and the loop waits for that turn.
5. **Parallel items, verification and the CLI are later phases.** Each is a separable change, and the research argues against parallel items by default.
6. **Each run gets a fresh context, in the same session.** Ralph, Claude Code's best practices and Reflexion all favour a fresh context with a short note over one growing conversation. A subagent per item would also give one, but subagents cannot ask the person. Slicing the request keeps the transcript in one chat, and the system and tools prefix stays cached. This replaces the earlier open question "one conversation or a fresh context per item".
7. **Autonomy is one setting that follows the approval mode.** Several options (re-plan acceptance, what happens when everything waits, budgets) need a hands-off setting. Separate switches would let a loop be "YOLO" in one place and supervised in another. So there are three levels, the approval mode picks the starting one, and the hard limits are the same in all of them.

## Sources

- **The Ralph loop** (fetched 2026-11-07):
  - https://ghuntley.com/ralph/
  - https://github.com/ghuntley/how-to-ralph-wiggum
  - https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop

All fetched on 2026-11-07 by the research pass.

- **Claude Code:**
  - https://code.claude.com/docs/en/scheduled-tasks
  - https://code.claude.com/docs/en/goal
  - https://code.claude.com/docs/en/permission-modes
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/agent-teams
  - https://code.claude.com/docs/en/headless
  - https://code.claude.com/docs/en/tools-reference
  - https://code.claude.com/docs/en/hooks-guide
  - https://code.claude.com/docs/en/best-practices
- **Anthropic engineering:**
  - https://www.anthropic.com/engineering/building-effective-agents
  - https://www.anthropic.com/engineering/multi-agent-research-system
  - https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Cline:**
  - https://docs.cline.bot/features/plan-and-act
  - https://docs.cline.bot/features/auto-approve
- **Roo Code:**
  - https://roocodeinc.github.io/Roo-Code/features/boomerang-tasks
  - https://roocodeinc.github.io/Roo-Code/advanced-usage/available-tools/ask-followup-question
  - https://roocodeinc.github.io/Roo-Code/update-notes/v3.22.6
  - https://roocodeinc.github.io/Roo-Code/advanced-usage/rate-limits-costs
- **Kiro:**
  - https://kiro.dev/docs/specs/
  - https://kiro.dev/docs/specs/best-practices/
  - https://kiro.dev/docs/ide/chat/autopilot/
  - https://kiro.dev/docs/hooks/
  - https://kiro.dev/docs/crew/features/task-runner/
- **OpenHands:**
  - https://docs.openhands.dev/sdk/guides/agent-stuck-detector
  - https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/conversation/stuck_detector.py
- **Devin and Cognition:**
  - https://docs.devin.ai/admin/billing/usage.md
  - https://docs.devin.ai/api-reference/v3/sessions/post-enterprise-sessions-messages.md
  - https://docs.devin.ai/use-cases/best-practices.md
  - https://cognition.com/blog/dont-build-multi-agents
- **OpenAI Codex:**
  - https://learn.chatgpt.com/docs/cloud
  - https://learn.chatgpt.com/docs/non-interactive-mode
  - https://learn.chatgpt.com/docs/agent-configuration/agents-md
- **Cursor:** https://cursor.com/docs/cloud-agent
- **Aider:**
  - https://aider.chat/docs/usage/modes.html
  - https://aider.chat/docs/usage/lint-test.html
- **Papers:**
  - ReAct, https://arxiv.org/abs/2210.03629
  - Plan-and-Solve, https://arxiv.org/abs/2305.04091
  - LangChain planning agents, https://www.langchain.com/blog/planning-agents
  - LLMCompiler, https://arxiv.org/abs/2312.04511
  - ADaPT, https://arxiv.org/abs/2311.05772
  - Reflexion, https://arxiv.org/abs/2303.11366
  - MAST, https://arxiv.org/html/2503.13657
  - Ambig-SWE, https://arxiv.org/abs/2502.13069
  - Ask or Assume?, https://arxiv.org/abs/2603.26233
  - LHAW, https://arxiv.org/abs/2602.10525
- **Runaway loops and budgets:**
  - BabyAGI, https://github.com/yoheinakajima/babyagi_archive
  - AutoGPT classic, https://github.com/Significant-Gravitas/AutoGPT/blob/master/classic/original_autogpt/README.md
  - SWE-agent, https://swe-agent.com/latest/reference/model_config/
