# Loop mode

Last updated: 2026-11-07. Status: L1 (core state machine), L2 (IDE, with autonomy levels), L3 (CLI and `cn serve`) and most of L5 (plan slots, controls, strategies, Loop as a mode) built, with unit tests, gui integration tests, and CLI flow tests through the TUI and `cn serve`. Five sandbox runs on a local model are done (see "Sandbox runs on a local model"). L4 (parallel items, verification) is not built.

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

All of the logic is in `core/util/loopMode.ts`: pure functions, no I/O. The gui and the CLI apply their results.

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

### Reminders (built)

Built on 2026-11-08. Each item starts in a fresh context, so `finish_item`'s `notes` was all that carried over. In two sandbox runs the model saved real findings and hit the 300-character cap mid-sentence, and `notes` can only be written when an item ends, so a stopped or crashed run lost what it found.

`remind_me(note, when, item?, files?)` (`RemindMe` in the CLI) saves a note for one later run. The logic is in `core/util/loopReminders.ts`. It is offered only while an item runs, and subagents never get it.

- **Saved at once** on `LoopState.reminders`, persisted with the session, and ended with the loop. Cross-session memory is out of scope.
- **`when`:** `item` (that item's run; needs `item`), `next_items` (the next other item that runs), `retry` (a later run of this item), `replan` (the next round re-plan or check-in). A repair of a failed item gets only that item's `retry` and `replan` notes, because it may change only that item.
- **After a re-plan:** a re-plan matches items by their text, so a `retry` or `item` note whose item was reworded or dropped goes to the next item that runs. A `replan` note keeps the loop from ending until a re-plan has read it.
- **Delivered once,** in that run's opening prompt, so the prompt cache is not touched. If that run ends without reporting (stopped, failed, reloaded), its reminders go back to undelivered, since the next run starts without its context.
- **Staleness:** the harness stamps each file in `files` when the note is saved and again when it is delivered. A file that changed or went away marks the note "written before these files changed, so check first". The basis is the finding that stale failure traces harmed 34 of 135 correct starts, against 4 of 135 with current ones.
- **Limits:** 2,000 characters per note, 20 per loop, 5 per item, 10 files per note (further files are ignored). A note over a limit is refused with the reason rather than clipped, since clipping mid-sentence was the problem. Saving the same undelivered note twice is one reminder.
- **At the turn limit** in the IDE, `remind_me` still runs while reading stops: saving what it found is what such a run should do.
- **Next to the others:** `notes`, `hold_question` and the person's "For every item" instructions are unchanged. The item prompt gains one line asking the model to save what a later item or a retry will need.

This is a design choice. No study tests a reminder tool, and models tend to under-use optional tools, so whether it gets called has to be measured in the runs.

**Coming back later** uses the same delivery, with no extra tool. `finish_item` takes outcome `later` when another item may settle this one, and needs `reminder`: what was tried, what was learned, and why it may go better later.

- The item goes behind the other runnable items (`nextRunnableItem`). The extension still picks what runs next; the model never chooses, and a work turn never reorders the plan.
- It is not marked failed. It does not count toward `consecutiveFailures`, as a finished item for no-progress, or as an attempt.
- The reminder is delivered when the item comes back, with the same staleness marking. It is not held to the reminder caps, so a deferral can always say why.
- **One deferral per item** (`LOOP_MAX_DEFERRALS`), because `later` is an easy way out of hard work. A second `later` is recorded as stuck. The loop's status shows how many items were deferred, so dodging is visible.
- `after:` dependents of a deferred item keep waiting. When only deferred items remain they run; the loop does not re-plan or stop because they were deferred.
- The repeat-refusal and turn-limit messages mention it.
- "Follow up on this" needs nothing new: `remind_me` with `when: "replan"`, so the re-plan can add the work as a to-do.

There is no measured evidence for deferral itself. It is a design choice, and the runs should count how often items are deferred and whether they succeed when they return.

**Measured in run 6** (one run, one model, a small task, so this says little in general). The model called `remind_me` 7 times over 6 items without being prompted beyond the one line in the item prompt. It used `next_items` four times, `item` twice and `retry` once, with notes of 294 to 896 characters, past the 300-character cap of `notes` in six of the seven. Five were delivered. The other two were a `retry` for an item that did not run again and a `next_items` from the last item, which had nothing after it. No item used `later`, so deferral has still not been exercised by a real model.

### IDGAF

A fourth level beside Supervised, Auto and Unattended, picked explicitly. It controls whether questions reach the person. The agent answers every question itself, including important decisions: `hold_question` records what it decided and tells it to go on, an item that reports `waiting` runs again, and the item prompt says to decide. Approvals are separate, and belong to the approval mode: with YOLO none are asked at all, and one held under another mode cannot stop the loop.

At the other levels a held question does not stop other work. An item that waits on an answer is set aside and the next runnable item runs; the loop pauses only when every open item is waiting on the person.

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

The IDE was wired first. The CLI (L3) has its own streaming loop and tool set, so it has its own wiring of the same core functions in `extensions/cli/src/loop/`. The decisions and prompts all come from core.

| Piece          | IDE                                         | CLI                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry          | Plan card: **Build in a loop**              | PresentPlan's question: Build, **Build in a loop**, Keep planning. The level comes from `loopAutonomyFor` applied to the CLI's approval setting: the `auto` mode is YOLO (Unattended), `--auto-review` is Auto, otherwise Manual (Supervised)                                                                                                      |
| Driver         | `useLoopDriver`, `advanceLoop`              | `nextLoopTurn` (`loopDriver.ts`) finishes what ran and returns the next turn's prompt. The TUI's `LoopRunner` sends it when nothing is going on; `cn serve` sends it from `processMessages` after the queue. The person's queued messages go first in both                                                                                         |
| Tools          | `hold_question`, `finish_item`              | `HoldQuestion`, `FinishItem`, with core's descriptions and parameters. Offered only while an item runs in a mode other than Plan, and TaskList is hidden then. Core's prompts and results take the CLI's names (`LOOP_CLI_TOOL_NAMES`)                                                                                                             |
| Turn end       | `finish_item`'s `endTurn`                   | FinishItem, a re-plan's PresentPlan, and "Build in a loop" ask `streamChatResponse` to end the turn after the tool round, without another request                                                                                                                                                                                                  |
| Approvals      | `applyLoopHolds`                            | `holdLoopCall` in `checkToolPermissionApproval`, where a call would ask (or, headless, be refused), after hooks, rules and the reviewer. The repeat limit is checked per batch in `executeStreamedToolCalls`. The loop's own two tools are never held. Under `cn serve`, which is headless, "ask" tools are offered to an item so they can be held |
| Fresh context  | `buildChatRequest` slices at `historyIndex` | `loopRequestHistory` slices the request in `streamChatResponse`, only for the main session (not a subagent or compaction)                                                                                                                                                                                                                          |
| Steered answer | A queued message tagged `loopAnswerId`      | Kept by the loop and merged into the host's tool-boundary callback (`withLoopSteering`), ahead of what the person steered with; one that misses the run is settled by `settleSteeredAnswers` as in the IDE                                                                                                                                         |
| Inbox          | `LoopInbox`                                 | `/loop` opens it; a strip above the prompt shows the loop's state. Answer, Keep the default, Allow once, Don't allow, a note about the plan (next re-plan, Re-plan now, For every item), Continue the loop, Resume, the level, and Stop loop                                                                                                       |
| Persistence    | `Session.loop`, `restoreLoop` on load       | The same field, saved with the CLI session; `restoreLoop` runs whenever a session is set (`--resume`, `cn serve --id`)                                                                                                                                                                                                                             |
| Stop           | Stop button                                 | Esc in the TUI and `POST /pause` stop the loop; a turn that fails during a step stops it too, with "Resume to go on"                                                                                                                                                                                                                               |

`cn serve`:

- `GET /state` adds `loop` (the `LoopState`, or null) and `loopStatus` (the inbox's status line).
- `POST /message` takes, instead of `message`:
  - `{loopAnswer: {questionId?, itemId?, text, confirm?, approve?, replanNow?, standing?}}`, routed by `answerLoop`. The response gives the answer's id and route.
  - `{loopAction: "start" | "stop" | "resume" | "continue"}`: build the session's plan in a loop (a headless PresentPlan saves it without asking), Stop loop, Resume, and Continue the loop after a re-plan that waits for the person.
  - `{loopAutonomy: "supervised" | "auto" | "unattended"}`, the level picker.

## Next: Loop as a mode, plan slots, strategies and controls (proposed, L5)

Proposed on 2026-11-07, after L3. Built the same day: the plan slots, the controls, three of the strategies, and Loop as a mode. Recursive descent and the Ralph strategy are not built. Loop as a mode revisits decision 2; recursive descent would need the plan-file format change decision 2 ruled out, so it waits for the owner.

### Loop as a mode (built)

**Loop** is an entry in the mode picker, after Chat, Plan and Agent:

- the first message starts a Plan-mode turn;
- when that plan is presented, the loop starts by itself (no Build in a loop click), at the level the approval mode implies;
- while the loop runs, the picker shows Loop with the loop's status line.

There is still no `MessageModes` or CLI `PermissionMode` value: every turn the loop sends is an Agent or Plan turn, so tool filtering, policies and the prompt cache are untouched.

- **IDE:**
  - `session.loopRequested`, saved with the session, says the person chose Loop. `chooseLoopMode`, `leaveLoopMode` and `startLoopIfRequested` are in `gui/src/redux/thunks/loop.ts`; `selectModeEntry` gives what the picker shows.
  - `presentPlanImpl` starts the loop when the flag is set and no loop is going, so a loop's own re-plans behave as before. The plan card then says the loop is building the plan.
- **CLI:**
  - Shift+Tab and Right step forward, and Left back, through normal, plan, loop and auto. `cycleModeEntry` is in `src/loop/loopSession.ts`, and the flag is held in memory there.
  - The status bar shows `[⟳ loop]`.
  - With the flag set, PresentPlan answers Build in a loop without asking.
- **Leaving Loop while an item runs** stops the loop after that item. The new mode is applied only then, so the item finishes with the tools it started with. Between items the switch is immediate.
- **When a loop ends while Loop is still picked,** the mode goes back to Plan, so the next message plans again.
- **Messages typed while the loop runs** keep today's queue and steering; they do not start a new loop. A note about the plan goes through the inbox.
- **Not built:** a `--loop` command-line flag.

### Plan slots (built)

Built on 2026-11-07. Before, an item run saw only its own prompt and the plan file's path: the task list block is sent only when the TaskList tool is offered, and the loop hides that tool while an item runs. Now every request of an item's run carries a **plan block** (`loopPlanBlock` in core): a read-only checklist with one slot per item, the running item marked, then the notes earlier runs left and the person's standing instructions.

```
<task_list>
The plan, kept for you and read-only. Work only on the item marked "<- this item"; ...
[x] 1. Add a retry helper: Added withRetry
[>] 2. Use it in fetch  <- this item
    q1 (approval): Allow this call? Write: src/fetch.ts
[ ] 3. Update the docs

Notes from earlier items:
- npm test works
</task_list>
```

- **Where:** after the item prompt, in the same message, with the task list's `<task_list>` tag. It is computed once, at the run's first request (`loopRunPlanBlock`, keyed by `loopRunKey`), and is the same for every request of the run, so each request only extends the one before it. The stored history keeps the prompt without it. The gui adds it in `buildChatRequest`, the CLI in `loopRequestHistory`. Neither sends it for a subagent's or compaction's request.
  - It was first sent last in every request, where the task list block goes, and rebuilt each time. The sandbox runs showed what that costs: each request diverged from the one before right where the old block sat, so a local server reused only the system message and the tools. See "Sandbox runs on a local model".
  - What changes during the run reaches the model where it happens: a held question in its tool result, an answer as a steered message. The block shows it from the next run on.
- **What a slot shows:** the item's status and number. A done or failed item adds its run's summary (clipped to 160 characters); a waiting or redo item says so. Below the item go its open questions, each with the assumption it was made on.
- **The prompt is shorter:** with the block, `loopItemPrompt` (`planBlock: true`) leaves out the notes and the standing instructions, which ride in the block. The answers for the item stay in the prompt, as they are delivered once.
- **Order stays with the harness:** the block marks the item. It never asks the model to choose one, and a test checks it does not mention a next item or the loop.
- **Re-plans keep their own prompt,** which already lists every item with its state, so they do not get the block.
- **In the TUI:** while a loop runs, the plan shows above the prompt as a checklist in place of the one-line task strip, like the queued messages. Finished items but the last fold into a count, at most 8 lines are shown, and an item that waits says what it waits on. `/loop` shows the whole plan with each item's summary.

### Strategies (three built)

Built: Finish what you started, Check in, and Fix forward, in core (`LoopState.strategy`, `LOOP_STRATEGIES`, `setLoopStrategy`, `endReplan`, `loopItemRepairPrompt`, `repairDecision`) with a picker in both inboxes and `loopStrategy` in `cn serve`. Not built: Recursive descent (needs nested checkboxes in the plan file) and Ralph. Ralph lets the model pick its item, but everything in a run binds to the item when the run starts (questions, held approvals, steered answers, the repeat guard, the plan block's marker), so choosing at `finish_item` would mean re-attributing all of that afterwards.

A second setting next to the autonomy level. Autonomy is how much the loop does without the person; the strategy is how it moves through the plan. Every strategy keeps the limits that hold today: the person's rules, held approvals, the repeat limit, the budgets, and the three-failures stop.

| Strategy                            | Next item                                    | Re-plan when                                                                            | On failure                                      | Defaults                                                                                                                      |
| ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Finish what you started** (today) | Plan order                                   | Nothing can run                                                                         | Run again, then failed                          | 2 attempts                                                                                                                    |
| **Check in**                        | Plan order                                   | Every 3 finished items, and at once when an assumption is overruled or an item is stuck | As above                                        | A check-in that changes nothing does not count as a round                                                                     |
| **Fix forward**                     | Plan order                                   | A re-plan of just the failed item                                                       | Retry once, then reword, split or drop the item | At most 2 re-plans per item, then failed and move on                                                                          |
| **Recursive descent**               | Depth first                                  | When coming back up: the parent runs once to check its children                         | The item splits into child slots                | Depth at most 3 (one level is the usual case), at most 5 children per split, at most 50 slots. Supervised confirms each split |
| **Ralph**                           | The model picks the most important open item | Every round                                                                             | Next iteration                                  | At most 20 iterations; offered with Auto and Unattended only                                                                  |

**Defaults:**

- Supervised: Finish what you started.
- Auto: Fix forward.
- Unattended: Fix forward, with the per-item re-plans counted against `maxRounds`.

Recursive descent and Ralph are opt-in. Running items in parallel (best-of-N) stays in L4.

**Why these defaults:**

- **When to re-plan:**
  - Re-planning at every step is costly and adds backtracking, and so does never re-planning; intermediate or event-triggered re-planning does better (Learning When to Plan, arXiv 2509.03581).
  - Reflection works best at critical steps, not every step (arXiv 2506.12928; UNVERIFIED).
  - One study found re-planning every step best (PilotRL; UNVERIFIED), so the best interval depends on the task.
  - An item is many model steps, so "every few items" is already coarse.
- **On failure:**
  - Repair the failing piece: ADaPT splits a task only when the executor fails, and TDAG adjusts later sub-tasks.
  - Kiro's Task Runner retries 3 times, then re-plans at most 2 times per step, and caps a run at 50 tasks.
- **Depth:**
  - ADaPT tested a maximum depth of 1 to 3, gained most from 1 to 2, and ran at 3 to 4.
  - ReCAP re-injects the parent's plan on the way back up and keeps the prompt bounded.
- **Self-reports need a check:** ADaPT's executors judged their own success, overstating it by more than 30 points on WebShop. So under recursive descent a parent counts as done only after its check, and preferably after the project's checks (L4).

Recursive descent needs to-dos with a parent. The plan file would hold the tree as nested checkboxes: still markdown, but a format change that decision 2 ruled out.

### Controls (built)

Built as described below: `skipItem`, `runItemAgain` and `setLoopBudget` (with `LOOP_BUDGET_BOUNDS`) in core; an "Items and limits" section in the IDE inbox; menu rows in the TUI's `/loop`, including Stop now; and `loopAction: "skip" | "again"` with `itemId`, plus `loopBudget`, in `cn serve`. A skipped item counts as finished but shows cancelled, and its questions stay open. An answer to it waits until the item runs again. Running an item again on a finished loop marks the loop stopped, so Resume appears.

Plain controls under the loop's status, in the IDE, the CLI and `cn serve`:

- **Stop after this item**, and **Stop now**. Both exist today: `requestStop` and `interruptLoop`.
- **Skip item.** New core function `skipItem`; a skipped item counts as done, like a cancelled to-do.
- **Run item again.** Reopens the item as redo.
- **Re-plan:** never (one pass over the plan), up to N times, or until done. This is `budget.maxRounds` made visible.
- **Limits:** rounds, tokens and time, defaulting to the level's values and editable while the loop runs. New core function `setLoopBudget`, with bounds. Changing the level resets them, as now. This answers open question 4.

In `cn serve`, these are more `loopAction` values (`skip`, `again`) and a `loopBudget` field.

### Order of work

1. **Plan slots** (built).
2. **Controls and editable limits** (built).
3. **Strategies** (Finish what you started, Check in and Fix forward built; Ralph not built).
4. **Loop as a mode** (built).
5. **Recursive descent,** after the nested plan file is agreed.

The sources are listed under Sources below, under "Strategies".

## Next: parallel work and plan-item improvements (L6; items 1 to 3 built)

Proposed on 2026-11-07, from three research passes: how other tools run work in parallel, an audit of this repository, and research on plan items. The owner approved the plan-file syntax the same day, and items 1 to 3 are built (see "Built: checks and dependencies" below). Items 1, 2 and 8 add optional indented `key: value` lines under a to-do; a plain checklist ignores them. The parallel-agents plan (`plans/parallel-agents.md` on `next/2.6`; the `after:` change is #342) uses the same lines, adding `folder:`:

```
- [ ] 3. Parse config files
  after: 1, 2
  check: npm test -- config
  model: fast
```

### What other tools do

- **Isolation and merging:** every tool isolates parallel work in a worktree, VM or branch, and none merges automatically: the person reviews a PR or a diff. Conflicts are avoided by splitting files up front, not resolved afterwards.
- **Cursor:**
  - `/best-of-n` runs one task on several models in separate worktrees and only compares them.
  - "Build in Parallel" runs a plan's independent steps as subagents; its changelog does not say how it decides independence.
  - Worktrees are capped at 25.
- **Claude Code:**
  - Subagents: depth 3, 20 at once.
  - Agent teams: a shared task list with dependencies and a completion gate (`TaskCompleted`).
  - `/batch`: 5-30 approved units, each with its own worktree and PR.
- **Others:**
  - Codex runs 1-4 attempts.
  - Kiro's Task Runner runs 3 in parallel, each on its own branch.
  - Jules runs 3 concurrent tasks on its base plan.
  - Devin's coordinator gives each child its own budget.
  - Amp's subagents start with only the context they are given, and its Oracle advises but never edits.
- **The arguments against parallel items:**
  - Cognition: actions carry implicit decisions, and parallel agents make conflicting ones. It accepts read-only subagents that answer a well-defined question.
  - Anthropic: multi-agent systems use about 15x the tokens of chat, and coding has fewer parallel parts than research.
  - GitHub: keep work sequential when steps depend on each other.

### What this repository has

- **No Agents panel and no worktree manager yet.** The parallel-agents plan plans both (`plans/parallel-agents.md` on `next/2.6`: A1 the panel, A3 the worktree service). The only worktree code today is `cn review`, which forks a worker process per review in a temporary worktree and returns the patch as text.
- **IDE subagents:** at most 3 at once (`core/subagents/scheduling.ts`), and depth 1. They **cannot edit files**: the edit tools are client tools, which `core/subagents/tools.ts` filters out.
- **CLI subagents:** they run one at a time, and while one runs it swaps process-wide services (the chat history reads as not ready). Parallel items in one process are unsafe; the CLI would need worker processes, as `cn review` uses.
- **Checkpoints:** IDE only, per turn, so each serial item can already be restored there. They miss terminal-command edits and anything a subagent writes. The CLI has none.
- **Models:** a model per mode exists, so item runs and re-plans can already use different models. There is no model per item.
- **One running item** is assumed in about 25 places, all through `LoopState.current`.

### Proposals, ranked by value for the effort

| #   | Proposal                                                                                                                                                                                                                                                                                                          | Default                                          | Why                                                                                                                                                                                                           | Effort     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **A check per item** (`check:`): the loop runs it after FinishItem(done); exit 0 confirms done, a failure sends the item back with the output. An item without one is "done (unverified)". A plan-level `smoke:` runs before each item                                                                            | On when given; the planner is asked to write one | Self-reports are unreliable: ADaPT's were inflated by more than 30 points on WebShop. Kiro, Claude Code's `/goal` and Anthropic's long-running harness all gate done on something other than the agent's word | Low        |
| 2   | **Dependencies** (`after: 1, 2`): an item waits for those slots; a stuck or skipped dependency makes it "blocked on N". Cycles and dangling references are refused                                                                                                                                                | None                                             | Every parallel tool depends on this, and it settles open question 2 even without parallel work                                                                                                                | Low        |
| 3   | **A fuller row per slot:** waiting on N, attempt n/4, check passed / failed / none, rounds and tokens spent, last note                                                                                                                                                                                            | On                                               | What Kiro and Claude Code show per task                                                                                                                                                                       | Low        |
| 4   | **Item size:** tell the planner "one reviewable change that one check can verify, about an hour"; split an item that ends stuck twice                                                                                                                                                                             | On                                               | 91% of SWE-bench Verified tasks take under an hour (Epoch); ADaPT splits on failure                                                                                                                           | Medium     |
| 5   | **A read-only scout** before an item: maps the code it needs, summary into the slot                                                                                                                                                                                                                               | On in Auto and Unattended                        | The one kind of subagent Cognition and Amp accept; IDE subagents can do it today                                                                                                                              | Low-medium |
| 6   | **A read-only verifier** after an item: judges the diff and the check output, never the self-report                                                                                                                                                                                                               | Off                                              | Like Claude Code's completion gate and Amp's Oracle; a model call per item                                                                                                                                    | Medium     |
| 7   | **A snapshot per item:** the starting commit and a `git stash create` ref on the slot; reverting is offered, never automatic. Commits only on a loop branch                                                                                                                                                       | Snapshot on, commits off                         | Kiro's `reset --hard` and Aider's auto-commits show the risks                                                                                                                                                 | Medium     |
| 8   | **Per-item `model:`, `effort:` and `budget:`**, inherited from the loop; one step up on the second attempt                                                                                                                                                                                                        | Inherit                                          | No automatic routing: RouteLLM and FrugalGPT were not tested on coding agents                                                                                                                                 | Low-medium |
| 9   | **Best-of-N for one hard item:** up to 3 attempts in worktrees; the person picks in the inbox                                                                                                                                                                                                                     | Off; Supervised first                            | Codex, Cursor; N times the tokens                                                                                                                                                                             | High       |
| 10  | **Independent items in parallel:** waves of at most 3, only items whose `after:` is met and whose declared files do not overlap. Extra items run as subagents in their own worktrees (a worker process in the CLI) and merge one at a time after their check passes. A conflict sends the item back to run inline | Off                                              | Kiro and Jules use 3. The arguments above say most plan items are a poor fit. About 1,500-2,000 lines; running core tools in a worktree path is the first thing to prototype                                  | High       |

Items 1 to 3 came first: they are small, and they make 10 safer later. Items 9 and 10 belong to the parallel-agents plan (`plans/parallel-agents.md` on `next/2.6`, #342) rather than to Loop mode: its A3 (the worktree service), A5 (Build in parallel from plan files, reading the same `after:` lines) and A6 (best of N). Loop mode would run its independent items through those once they exist. Item 10 also needs IDE subagents that can edit files and a working-directory override for core's tools.

### Built: checks and dependencies

Built on 2026-11-07, in core (`core/util/loopMode.ts`, `taskPlan.ts`, `planFile.ts`), and the CLI and `cn serve` (`extensions/cli/src/loop/loopChecks.ts`). The IDE side (running the check from `advanceLoop` under the gui's tool policies) is in progress.

- **The syntax:**
  - `after: 1, 2` and `check: <command>` lines under a to-do. Positions become ids (`TaskItem.after`) when the file is read, and are written back as positions.
  - Circles, an item after itself, and numbers out of range are refused.
  - The plan tool takes them as to-do objects or in `todo_details`. Its description asks for one reviewable change per to-do that one check can verify.
- **Dependencies:**
  - An item runs only after what it comes after is done; a skipped item does not count as done.
  - A failed or skipped dependency blocks it (shown as "Blocked on N"), and the loop re-plans.
  - Items held only by an item that waits on the person wait too.
- **Checks:**
  - An item that reports done with a check becomes `checking`. Before anything else, `decideNext` returns a `check` action, and the harness runs the command: it is not a model turn.
  - Exit 0 makes the item done. Anything else sends it back for another attempt (up to `maxAttempts`), with the output tail in its next prompt.
  - The command goes through the same permission decision as a terminal command the model makes. A call that would ask is held as an approval question in the inbox, and Allow once runs it on the next step. A refused one, by a rule or by the person, leaves the item done without its check.
  - In the CLI it runs in the workspace with a 10-minute limit. In the IDE it runs through the IDE's `subprocess`, which reports pass or fail but no exit code.
- **The slot row:** the plan block, the task list and the inboxes show what an item comes after or is blocked on, its check and the last result, and the running item's attempt (n of `maxAttempts`).
- **Not built yet:**
  - the plan-level `smoke:` command;
  - rounds and tokens spent per item;
  - PreToolUse hooks for check commands.

### Proposed: what does done look like (Done first)

Proposed on 2026-11-07 from the owner's idea: "perhaps one of our loop modes can focus on 'what does done look like?'". Not built; for the owner to review.

**The idea.** Before any item runs, the loop writes what done looks like: for the whole goal, and for each item. These are observable acceptance criteria:

- a `check:` command where one can be run;
- otherwise a statement a read-only verifier can confirm from the code or the output.

The person approves or edits the criteria once, like the plan. Vague ones ("works", "is clean") are rewritten into something checkable. From then on:

- An item is done only when its criteria pass: its `check:` exits 0 and the verifier confirms each `done:` line. The agent saying so is not enough. A failing criterion runs the item again or re-plans it.
- The loop ends when the goal's criteria are met. That may come before the listed items run out (the rest are dropped at a re-plan) or after (the re-plan adds the missing work).
- A criterion that cannot be checked becomes a question in the inbox, not an assumption.

**Syntax.** One more key line in the L6 format, repeatable:

```
# Retry failed fetches

## Done

- done: a fetch that fails twice with 503 and then succeeds returns the response
  check: npm test -- retry.e2e

## To-dos

- [ ] Add a retry helper
  check: npm test -- retry
  done: retries use exponential backoff capped at 30 seconds
```

The goal's criteria sit under a `## Done` heading, before the to-dos. An item's go under it, next to `after:` and `check:`.

**Where it belongs: a planning step and a stop condition, not a strategy.** A strategy decides how the loop moves through the items: in order, with check-ins, or by repairing a failure. "What does done look like" decides what counts as done, and that applies under every strategy. Fix forward with done criteria makes sense, and so does Check in with them. As one more strategy it would have to exclude the others. So the proposal has four parts:

1. **A plan step.** The re-plan and plan prompts ask for the `## Done` section and per-item `done:` lines, rewriting vague ones. The plan card, or the inbox for a re-plan, shows them for approval. The existing "one reviewable change that one check can verify" sizing advice becomes "every item names how we will know it is done".
2. **The item gate.** `checking` (L6) covers `check:` already. `done:` lines are confirmed by the read-only verifier (L6 item 6), which judges the diff and the check output against each line and never the agent's own report. A line the verifier cannot confirm either way becomes an inbox question.
3. **A goal stop.** `decideNext` gets a "goal met" stop: when the goal's `check:` passes and its `done:` lines are confirmed. When every item is done but the goal is not met, the loop re-plans instead of stopping as done. This uses the round limit and the no-progress stop, so it cannot loop forever.
4. **A setting, not a mode:** **Done first**, on or off, next to the strategy picker. The default:
   - off in Supervised, since the person reads the plan anyway;
   - on in Auto and Unattended, where nobody reads each item's result.

**Open questions.**

- **Verifier cost:** one model call per `done:` line, or one per item?
- **No check at all:** whether a goal with no runnable `check:` may still stop as "met" on the verifier alone.
- **Dropping items:** how a goal met early drops the remaining items without the person losing work they wanted. Proposed: a re-plan that lists them, accepted by the level's rules.

**Depends on:** L6 item 6, the read-only verifier, which is not built. The `check:` half works today.

#### A fixed base prompt, a pinned done block, and a constant reminder

Added on 2026-11-07 from the owner. In their words: "use some sort of base prompt to ask the model / agent to potentially rephrase the task in a repeatable set of steps, and then also to identify the end state, separately, in a way that we could then repeat those in a cache optimized way, and continuously remind it / ask it what we need to reach the done state", and then "we could take advantage of our cached input reuse."

**The payoff is cached input reuse.** Every loop turn, and every item, should re-read the same prefix from the cache. Only the new tool results and the short reminder should be fresh input. The three pieces below exist for that:

1. **A fixed base prompt for planning.** It is the same text every time, so it caches. It asks for two separate outputs:
   - the task restated as a repeatable list of steps (the to-dos);
   - the end state, on its own and independent of the steps: the `## Done` criteria.

   This is the planning call that produces the plan file. The plan prompt and `loopReplanPrompt` would use it instead of their current wording.

2. **An immutable steps-and-done block, early in the prompt.** Once approved, the restated steps and the done criteria form one block placed right after the system message and the tools.
   - It is never edited in place. A re-plan or an edited criterion is appended as a short amendment ("D2 now reads: …; step 4 dropped") until the next round rewrites the block once.
   - Criteria get stable ids (D1, D2, …) so later turns can refer to them cheaply.
   - With a fresh context per item (Decision 6), each item's request is the same system message, tools and block, then that item's prompt. So the whole prefix up to the item prompt is shared across items, not only within one item's run.
   - The per-item state (the plan block's slots, built) goes after the item prompt, fixed for the run. It no longer goes at the tail: a block that changes at the tail cost a local server everything after the system message and the tools (see "Sandbox runs on a local model").
3. **A short, constant reminder at the tail of each turn.** It has the same wording every time and comes after the latest tool results and the slots: "Which of D1..Dn are met now, with evidence? What is the next step towards the rest?"
   - Its answer feeds `decideNext` (the goal stop) and the verifier.
   - Because it is the same small tail, it costs a few tokens per turn and never moves the cached boundary.

**How it is measured, with what exists:**

- **Per request:** the provider's usage reports cached input (`prompt_tokens_details.cached_tokens` on OpenAI-style APIs, cache-read tokens on Anthropic and Bedrock). Core turns that into one shape in `core/llm/utils/cacheStats.ts`. `core/llm/utils/cacheMinimums.ts` knows each provider's minimum cacheable prefix, below which nothing is cached.
- **Per session:** the gui's usage readout (`useTotalUsage`, `gui/src/util/cacheLedger.ts`) and the CLI's tally (`extensions/cli/src/util/cacheTally.ts`) add requests up, and could break them down by loop run.
- **Locally:** the sandbox's fake Strata server reports `cached_tokens` as the longest prefix it has seen. That gives a deterministic check without a provider.

  It is not in this repository. A loop test could assert the cached share of each request through it.

- **Targets to report** (proposed):
  - The cached share of each loop turn after an item's first request: everything but the new tool results and the reminder.
  - The cached share of each item's first request: the system message, the tools and the block should all come from the cache.
  - The loop's status line or inbox could show the running share, so a drop is visible when it happens.

**What breaks the reuse, and how the loop avoids it:**

- **Editing the block in place.** Changes are appended as amendments. The block is rewritten only when a round's re-plan is accepted, at most once per round.
- **Compaction rewriting the prefix.**
  - The block is pinned like the system message: compaction keeps it word for word, and the reminder stays the last thing before the model's turn.
  - With a fresh context per item, an item's run rarely grows enough to compact at all.
  - Compaction's own summary request is a one-shot, which #316's `oneShot` hints already keep from evicting the main conversation's cache.
- **Switching the model, the route or the reasoning effort mid-loop.** Any of these starts a new cache. The gui already warns on such a switch (`switchKeepsCache`, `gui/src/util/cacheSafeguards.ts`). The loop would:
  - keep one model, route and effort for the whole loop by default;
  - treat L6 item 8 (per-item `model:` and `effort:`) as a cache trade-off, shown when it is set;
  - warn before a mid-loop change, as the picker does.
- **Several runs sharing one cached conversation.** A single-slot server such as Strata holds one conversation, so interleaved requests evict each other's prefix. That is why subagents run one at a time against such a server (S1), and why parallel items (the parallel-agents plan) need a slot each.
  - The loop's own extra requests are one-shots: the verifier, a scout, and the reminder's evaluation if it runs as a separate call.
  - They should carry #316's `requestBodyHints.oneShot` fields (for Strata, `{"strata_checkpoint": false}`), so they do not replace the main conversation in the cache.
- **Bytes that change for no reason.** Timestamps, counters, or the attempt number inside the block. Anything that changes goes in the tail (the slots, the reminder), never in the block.

**Where it meets #316 (now on main).** `contextManagement.requestBodyHints` (`extensions/cli/src/contextManagement.ts` `getRequestBodyHints`, schema in `packages/config-yaml/src/schemas/models.ts`) is the existing way to tell the server how a request relates to the cached conversation:

- `conversation` fields go on requests that continue the conversation: an item's turns.
- `oneShot` fields go on requests nothing continues: the compaction summary today, and the verifier, a scout and a check-in's evaluation under this proposal.

The block and the reminder need no new mechanism: they make the prefix stable, and the server's own prefix matching does the rest. The sandbox runs qualify that for a hybrid model, which resumes only from a checkpoint: a reminder at the tail needs a checkpoint before it, which `strata_prefix` gives (see "Sandbox runs on a local model"). A prefix hint already has a worked example: `extensions/cli/src/contextManagement.test.ts` configures `conversation: { strata_prefix: { messages: 1 } }` beside `oneShot: { strata_checkpoint: false }`, and checks that each lands only on its kind of request. `strata_prefix` is not a field the CLI knows; it is whatever the config passes through. A hint naming the block, for a server that takes one, would be one more such `conversation` field.

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

## Sandbox runs on a local model

Run on 2026-11-07 against Strata, a single-slot OpenAI-compatible server on this machine. The model was `qwen3.8-flash-next-nvfp4-nvfp4`, a hybrid reasoning model. The task was a five-item plan in a throwaway repository: `slugify` and `truncate`, their tests, and a README. Each item had a `check:` command.

`cn serve` did the work, from the built CLI. A driver script played the person over `/state` and `POST /message`: it allowed held approvals, kept assumptions, answered blocking questions, and started the loop once the plan was presented.

| Run | Result                                                                                                                                              | Approvals held | Cached share of prompt tokens                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------- |
| 1   | Stopped on no progress: 0 of 5 done, 1 waiting                                                                                                      | 19             | not counted yet                                                        |
| 2   | 5 of 5 done, every check passed, the repository's 19 tests pass, about 5 minutes                                                                    | 4              | not counted yet                                                        |
| 3   | 5 of 5 done, every check passed                                                                                                                     | 4              | 41% over 45 requests (first request of a turn 64%, later ones 39%)     |
| 4   | stopped early, through a logging proxy that saved each request                                                                                      | 3              | 33% over 28 requests                                                   |
| 5   | 5 of 5 done, every check passed, the repository's 20 tests pass, about 6 minutes, with the plan block in its new place                              | 6              | **89%** over 51 requests (first request of a turn 53%, later ones 91%) |
| 6   | 6 of 6 done, every check passed, the repository's 14 tests pass, about 13 minutes while other work shared the machine, with `remind_me` and `later` | 8              | 92% over 82 requests (first request of a turn 54%, later ones 94%)     |

**Bugs run 1 found, fixed before run 2:**

- `ToolPermissionService` started in plan mode kept no normal-mode policies, so every call of an item was held.
- An item that ended "waiting" on a question answered meanwhile stayed waiting. It now runs again.
- A grant was keyed on the exact arguments, so a held Write did not cover the same file written again. Grants are now keyed on the command or the resolved path (`loopGrantKey`).
- `waitsOnPerson` treated a dependency it had already visited as not waiting. It now remembers each item's answer.

**Bugs the counting found:**

- The CLI read `cache_read_tokens` only. OpenAI-style servers report `cached_tokens`, so every cached share read 0.
- `cn serve` sent two system messages per request: the session's stored copy and the current one. Now one is sent.

**The cache break.** Within an item's run, every request reused exactly 2,792 tokens from the cache, which is the system message and the tools. Strata's log shows the same for another client's item loop: 47 of its last 60 requests reused exactly 2,792 tokens.

- **Cause:** the plan block was the last message and was rebuilt for every request. A hybrid model's recurrent state cannot rewind to an arbitrary position. The engine resumes only from a checkpoint, and it takes two per request: the end of the system message and tools, and the start of the model's turn. The second one lies after the plan block, and the next request puts an assistant turn at that position, so it is never a prefix. Only the first is left.
- **Not the cause:** the missing `reasoning_content`, since this model's template keeps earlier reasoning anyway; the tools; two user messages in a row.
- **Modelled cached share,** requests 6 to 18 of run 4, with the engine's checkpoint rules applied to the captured requests (the live replay was blocked: another client held the slot):

  | Plan block                                                                   | Cached share                                              |
  | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
  | Last, rebuilt per request (as run)                                           | 35%                                                       |
  | Dropped                                                                      | 93% (the ceiling)                                         |
  | After the item prompt, rebuilt per request                                   | 70%: it resets whenever a held question changes the block |
  | After the item prompt, fixed for the run (built)                             | 94%                                                       |
  | Last, with `strata_prefix: {messages: n - 1}` pinning a checkpoint before it | 89%                                                       |

- **Fix, built:** the block goes after the item prompt and is fixed for the run (see "Plan slots"). It helps any provider whose cache matches a prefix, not only Strata.
- **Measured, run 5:** 89% of all prompt tokens came from the cache, against 33 to 41% before, and 91% in the later requests of a run. Each request reused everything the one before it sent. Each later item's first request reused the 2,792 tokens of system message and tools.
- **Still to do:** Requests that must end with something that changes, such as the Done-first reminder, need a checkpoint pinned before it: Strata's `strata_prefix` as a `requestBodyHints.conversation` field, or Anthropic's `cache_control`.

### Runs on Amazon Nova

Run on 2026-11-08 on Nova 2 Lite (`us.amazon.nova-2-lite-v1:0`) through `cn serve`, in nine scenarios: planning, a basic loop, each strategy, a check that can never pass, deferral, stop and resume, and subagents alone and inside an item. A weaker model finds what a capable one steps around. Nothing was cached on Nova here, so a loop re-sends everything: the basic run read 928,000 prompt tokens. The cause was ours, not Nova's: no cache point was sent to it (plans/cache-next-features.md, "Nova on Bedrock"), fixed on `claude/bedrock-nova-cache`.

**Bugs found, all fixed:**

- `AskQuestion` was still offered during a loop's runs. In `cn serve` nobody can answer it, so the loop stalled for good. It is no longer offered while a loop runs an item or a re-plan.
- A re-plan could change or remove a failing check, or drop a finished item, and the loop then reported every item done. In one run a repair replaced the failing check with `test -f`. `replanConcern` now makes such a re-plan wait for the person at every autonomy level and says why.
- A new to-do could take the id of a dropped one and inherit its state. New ids now go above the previous list's. A check the accepted plan no longer has also loses its old result.
- `cn serve` ignored `--beta-subagent-tool`, and a headless run refused the `Subagent` tool for having no session id.
- A subagent never saw its own tool results: they were written to the main session's history, not to the subagent's. It re-read the same file and then gave up. This affected every CLI surface.

**Behaviour to keep watching:** Nova called `remind_me` once in nine scenarios, against seven calls by Qwen in run 6, so under-use is real on some models. Deferral worked, including the refusal of a `later` with no reminder. A subagent can still repeat one call many times, because the repeat limit covers only the main session.

## Phases

- **L1 (built):** `core/util/loopMode.ts` and `core/tools/definitions/loopTools.ts`, with unit tests in `core/util/loopMode.vitest.ts`.
- **L2 (built):**
  - IDE wiring: the plan card buttons, `LoopInbox`, `useLoopDriver`, `gui/src/redux/thunks/loop.ts`, `loopHolds.ts`, the client tools, persistence and the Stop path.
  - Integration tests in `gui/src/pages/gui/chat-tests/LoopMode.test.tsx` and `gui/src/redux/slices/sessionSlice.loop.test.ts`.
- **L3 (built):**
  - CLI wiring in `extensions/cli/src/loop/` (`loopSession.ts`, `loopDriver.ts`, `loopHolds.ts`), the tools in `src/tools/loopTools.ts`, the inbox in `src/ui/components/LoopInbox.tsx`, and `cn serve` in `src/commands/serve.loop.ts`.
  - Core: `LoopToolNames` for the CLI's tool names, `loopCallKey`, `finishItemReport`, and the tool schemas exported from `core/tools/definitions/loopTools.ts`.
  - Tests: `src/ui/__tests__/TUIChat.loopMode.test.tsx` (the whole flow through the TUI), `src/commands/serve.loop.test.ts`, `src/loop/loopDriver.test.ts` (re-plans, reload, steering, holds) and `src/tools/loopTools.test.ts`.
- **L4:**
  - Verification: an acceptance check per item, run by the harness before an item counts as done (a command from the plan, or a separate evaluator).
  - Parallel items as subagents, only for items the plan marks independent with disjoint files, at most 2 or 3, each in its own worktree. (An Agents panel was assumed here; the parallel-agents plan, `plans/parallel-agents.md` on `next/2.6`, plans it, and none exists yet. See "Next: parallel work and plan-item improvements".)
  - Checks the project names once (Ralph's `AGENTS.md` validation commands), run by the harness after each item as backpressure.
- **L5 (built, except recursive descent and Ralph):** Loop as a mode, plan slots, strategies and controls; see "Order of work" above.
- **L6 (checks, dependencies and the slot row built):** plan-item improvements; parallel work and best of N belong to the parallel-agents plan (`plans/parallel-agents.md` on `next/2.6`). See the section of that name.

## Open questions

1. **Notes or a file?** Ralph keeps its learnings in `AGENTS.md`, where they outlive the loop and any later session reads them. Here they live on the loop, so they end with it. Should accepting the last round offer to append them to the project's rules or AGENTS.md?
2. **Dependencies between items.** Settled by L6: an `after:` line under a to-do (TaskItem.after). What remains open is using them to run independent items at the same time, which is the parallel-agents plan's Build in parallel.
3. **Overruled assumptions downstream.** Overruling reopens only the item that made the assumption. Items built on it are not marked stale; the re-plan prompt lists unconfirmed assumptions so the model can rework them. Should a commit or push wait until the assumptions it depends on are confirmed?
4. **Budget defaults.** The budgets of each autonomy level are guesses, raised once after the sandbox runs. They are fields on `LoopState.budget` and follow the level, but there is no setting to change them yet. L5's controls made them editable while the loop runs.
5. **The 15-minute wait.** Unattended's wait is fixed. It could be a setting, or follow how long the person usually takes to answer.

## Decisions

1. **The extension runs the loop, not the model.** This is the brief, and the research supports it: harness scheduling works, and model-driven re-prioritisation runs away.
2. **No new mode, no new format.** Item runs are Agent mode and re-plans are Plan mode. Items come from the plan file and the task list. The new state is one session field. L5 revisited the first half: Loop is now an entry in the mode picker, but there is still no new `MessageModes` value and every turn is Agent or Plan underneath. The second half stands: the plan-file changes that recursive descent and L6 propose (nested checkboxes, `after:` and `check:` lines) wait for the owner.
3. **`finish_item` is the one addition to "say when it's done".** A structured report is what makes "done" checkable, and no report never counts as done. It also ends the turn without another request.
4. **Answers are routed when given, by the item's state, and kept on the loop.** A running item gets its answer by steering. The person's own messages keep the usual queue: they are sent at turn end as an ordinary turn, and the loop waits for that turn.
5. **Parallel items and verification are later phases; the CLI was L3.** Each is a separable change, and the research argues against parallel items by default.
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
- **Parallel work and plan items** (fetched 2026-11-07 for L6):
  - Anthropic, multi-agent research system, https://www.anthropic.com/engineering/multi-agent-research-system
  - Cognition, Don't build multi-agents, https://cognition.com/blog/dont-build-multi-agents
  - Cursor worktrees, https://cursor.com/docs/configuration/worktrees ; changelog, https://cursor.com/changelog/05-07-26
  - Claude Code subagents, https://code.claude.com/docs/en/sub-agents ; agent teams, https://code.claude.com/docs/en/agent-teams ; commands, https://code.claude.com/docs/en/commands
  - Codex CLI, https://learn.chatgpt.com/docs/developer-commands?surface=cli
  - GitHub mission control, https://github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/
  - Kiro Task Runner, https://kiro.dev/docs/crew/features/task-runner/
  - Jules limits, https://jules.google/docs/usage-limits
  - Amp subagents, https://ampcode.com/docs/models-and-subagents
  - LLMCompiler, https://arxiv.org/abs/2312.04511
  - Tests in the prompt, https://arxiv.org/html/2402.13521v2
  - SWE-bench Verified task sizes, https://epoch.ai/blog/what-skills-does-swe-bench-verified-evaluate
  - METR time horizons, https://arxiv.org/abs/2503.14499
  - RouteLLM, https://arxiv.org/html/2406.18665v4
  - Chroma context rot, https://trychroma.com/research/context-rot
- **Strategies** (fetched 2026-11-07 for L5):
  - Learning When to Plan, https://arxiv.org/html/2509.03581v2
  - Scaling Test-time Compute for LLM Agents, https://arxiv.org/pdf/2506.12928
  - PilotRL, https://arxiv.org/pdf/2508.00344
  - Plan-and-Act, https://arxiv.org/abs/2503.09572
  - ADaPT (depth and self-assessment), https://ar5iv.labs.arxiv.org/html/2311.05772
  - ReCAP, https://neurips.cc/virtual/2025/poster/115819
  - THREAD, https://arxiv.org/abs/2405.17402
  - TDAG, https://arxiv.org/html/2402.10178v2
  - CodePlan, https://www.microsoft.com/en-us/research/publication/codeplan-repository-level-coding-using-llms-and-planning/
  - Agentless, https://arxiv.org/abs/2407.01489
  - The Ralph Playbook, https://claytonfarr.github.io/ralph-playbook
