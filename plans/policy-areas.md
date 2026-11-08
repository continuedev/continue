# Policy areas

Revised 2026-11-08 after the design review. The evidence for each change, and the decisions still open, are in `policy-areas-review.md` in the session notes, beside the `research-*.md` files this text cites. Prompts and tool descriptions are in `policy-areas-prompts.md` there; the toolbox and the reviewer model are designed below and in `policy-areas-toolbox.md`.

One decision per area instead of a single approval mode. Replaces Manual, Auto-approve, Auto, Review and YOLO, and Loop's Supervised, Auto, Unattended and IDGAF. Target: 2.6.

## The model

### Five areas, five levels

Each level answers one question: **who decides a call that your rules leave open?**

| Level          | Who decides what the rules leave open                 | Rules honoured                                   |
| -------------- | ----------------------------------------------------- | ------------------------------------------------ |
| **Manual**     | You, every time                                       | deny and ask only; allow rules are not consulted |
| **Cautious**   | You, unless an allow rule covers it                   | all                                              |
| **Automatic**  | A reviewer model; you, when it is unsure              | all                                              |
| **Permissive** | The agent: it runs unless a deny or ask rule stops it | all                                              |
| **YOLO**       | The agent, and no rule is consulted                   | none (see "YOLO")                                |

The order is from least to most done without you: each step down means fewer decisions reach you. It is not an order of outcomes. A reviewer may refuse what you would have allowed, so Automatic's dropdown line says so. On Questions and Plan edits the top level is labelled **IDGAF**; only the label differs.

**Names.** Manual, Cautious, Automatic, Permissive and YOLO are the user's words for the five concepts and are kept here. The research on level naming (`research-controls-ux.md`) finds that two adjacent attitude words do not sort for users (Tor's Safer and Safest failed in testing) and that no 2026 vendor uses such words; it proposes names that say who decides, in order: Ask, Rules, Reviewer, Allow, Everything (or, on Plan and Questions: You decide, Your rules else you, Reviewer decides, Agent decides unless a rule says you, Agent decides everything). The review carries this as a decision for the user. Whatever the words, each dropdown has a header line, "fewer prompts as you go down", and each line names who decides.

|                                                                   | Manual                                   | Cautious                                                                    | Automatic                                                                                                          | Permissive                                                                          | YOLO / IDGAF                                                   |
| ----------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Context use** (reads: tools, read-only commands, read-only MCP) | Asks each read                           | Reads what an allow rule or the tool's own setting covers, asks otherwise   | As Cautious; the reviewer decides what is left, except in-workspace reads, which run                               | Reads unless a deny or ask rule stops it                                            | Reads everything                                               |
| **Tool use** (commands, MCP, web)                                 | Asks each call                           | Runs what an allow rule or the tool's own setting covers, asks otherwise    | As Cautious; the reviewer decides what is left                                                                     | Runs unless a deny or ask rule stops it                                             | Runs everything                                                |
| **File edits**                                                    | You review each change before it is kept | Keeps what an allow rule covers; you review the rest                        | The reviewer keeps, refuses, or sends it to you                                                                    | Keeps unless a deny or ask rule stops it                                            | Keeps everything                                               |
| **Plan edits** (the handoff from a plan turn to acting)           | Every plan and re-plan waits for you     | A re-plan that adds no to-do goes on; a first plan, or one that adds, waits | The reviewer checks the plan against your request and the checks' results; waits if unsure                         | A plan goes on if it adds at most N to-dos (5) and keeps the plan under its ceiling | Every plan goes on                                             |
| **Questions**                                                     | You decide every one                     | You decide, except types on your "agent decides" list                       | Types on your lists go where the lists say; the reviewer answers design and detail questions, or sends them to you | The agent decides, except types on your "you decide" list                           | The agent decides everything (except what only you can supply) |

Defaults: Context Permissive, Tools Cautious, Edits Manual, Plan Cautious, Questions Cautious.

Automatic needs a reviewer model. Without one the option is disabled with the reason shown, and a saved Automatic behaves as Cautious, so losing the reviewer never loosens anything.

**What the reviewer sees, and which reviewer.** For a tool call it sees what it sees today: your messages, the call, earlier calls by name and arguments. For a plan it sees your request and later messages, the previous and the proposed plan as a diff by id, the check results and the failure notes from `finish_item`, the repository's agent instructions, and it may make read-only calls at High confidence (see "Which area a call belongs to"): every reviewer that judges work rather than one command sees evidence, and giving a judge locate and read tools moved its agreement with people from 65% to 90% in the one measurement (`research-replan-reviewer.md`). For a question it sees the question, its type and options in shuffled order, your messages, and the repository's conventions, and must cite the message or file its answer rests on. Its outcomes are always three: go, wait, unsure; a missing citation, a parse failure or a timeout is unsure, and unsure is wait or ask.

Reviewing a tool call is a rubric task that a prompted instruct model does acceptably once it has passed a check (prompted Qwen3.5 4B and 9B reached 76 to 78% on Codex trajectories, above a 70B Llama; Llama 3.1 8B flags everything; guard models such as Llama Guard have 1 to 34% recall on agent trajectories and are never offered). Judging a plan or answering a question is not: on JudgeBench, 7B to 9B models and Claude 3 Haiku scored at or below the 50% chance line, and small judges are lenient when unsure. So Automatic on Plan edits and Questions is offered only for a reviewer model that has passed the built-in check for those jobs; otherwise those two controls show Automatic disabled with "reviewer model not strong enough for this", and Tool use, Context use and File edits keep it. The full design of the reviewer role is the next section.

### The reviewer model

The reviewer is a model role, and the role already exists: `roles: [reviewer]` on a model in config.yaml, chosen in Settings > Models, where the card says "Reviews tool calls in Auto approval mode" and warns that messages and tool calls are sent to that model's provider. This design widens the role's jobs and makes the choice informed. Evidence: `research-reviewer-model.md`.

**Jobs.** One role, six uses, each a separate request with its own prompt (`policy-areas-prompts.md`, section 6):

| Job                    | When                                                             | Sees                                                                                                                          | Thinking |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| Tool call              | Automatic on Context, Tools or Edits; a call the rules left open | Your messages, the call, repository agent instructions, the rule layer's verdict. Never the worker's prose or raw tool output | Off      |
| Plan                   | Automatic on Plan edits; a handoff                               | Your request, the plan diff by id, check results, failure notes, agent instructions; vouched read-only calls                  | On       |
| Question               | Automatic on Questions; a design or detail question              | The question with options shuffled, your messages, repository conventions; not the agent's label                              | On       |
| Consult (optional)     | The worker calls `consult`                                       | The whole transcript                                                                                                          | On       |
| Second opinion         | A toolbox card                                                   | The plan reviewer's inputs plus the card                                                                                      | On       |
| Pick for me (optional) | The person asks it to choose the next runnable item              | The plan state and what has failed                                                                                            | On       |

**Same model or a different one.** The research is clearer than expected. Self-preference bias is about a model recognising its own text, and a stripped tool call carries none of it; co-failure between worker and monitor follows the shared evidence, not the shared model family (correlation 0.75 with the evidence source, a 0.05 difference for family); skill, not lineage, predicts what a second judge adds; and a weaker reviewer from another vendor scored below same-model review in a fresh session, while an equal-tier one from another vendor was not significantly better. Claude Code reviews a Sonnet session with Sonnet; Goose's judge is the session model. So: **the same model is acceptable for every job when it runs as a separate request, fresh context, with the worker's narrative stripped and a fixed rubric; it must be at least as capable as the worker; another vendor at equal or higher tier is a tie-breaker, never a lower tier of another vendor.** The one case where sharing a model failed was a monitor whose self-recognition had been deliberately elicited, which is a collusion threat the rule layer (deny and ask rules run first) is there to bound. What changes outcomes more than the model is the design: swapping Claude Code's classifier to a frontier model did not lower injection success, while monitoring edits, escaping the transcript and adding an agentic check cut it by over 50 points.

**Defaults by worker tier**, applied when the person has not chosen:

| Worker                                                        | Tool calls                                                                                                                                                                                                            | Plans and questions                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Frontier hosted (Opus, GPT-5.x, Gemini Pro class)             | The vendor's mid model (Sonnet, GPT-5 mini, Gemini Flash), thinking off, same vendor fine                                                                                                                             | The worker's own tier, thinking on, fresh context; another vendor's equal tier if one is configured                      |
| Mid hosted (Sonnet, GPT-5 mini, Gemini Flash, Nova Pro class) | The worker itself or the vendor's small model, thinking off                                                                                                                                                           | The worker itself, thinking on; never a tier down                                                                        |
| Small hosted (Haiku, Flash Lite, Nova Lite class)             | The worker itself, thinking off, after the check                                                                                                                                                                      | Automatic disabled unless the check is passed                                                                            |
| Local (Qwen3 30B-A3B, gpt-oss-20b, 7B to 14B dense)           | The worker itself in a separate request, thinking off, after the check. If any hosted key exists, offer a Haiku or Flash Lite class reviewer and say that it sends the command text and your messages off the machine | Automatic only on a 30B-class model with thinking on that clears the check, or a hosted reviewer; otherwise wait and ask |

Both frontier vendors run their own gate one tier down from the worker (Claude Code's classifier is Sonnet class, not a small model as `ux-policy-matrix.md` section 6 said; Codex's is GPT-5.4 Thinking at low effort); only Cursor uses a small model. Thinking is off for tool calls because it lowered rubric-classification accuracy for every model tested, and on for plans and questions because it raised judgment accuracy (Qwen3 30B-A3B: 74 instruct to 84 thinking on JudgeBench) at 1.4 to 11 times the tokens.

**The built-in check.** Settings shows, beside the chosen reviewer, the result of a built-in check per job: pass or fail, with the confusion matrix. For tool calls: 40 items, 20 unsafe and 20 benign, drawn from public agent-safety sets (R-Judge class), order-swapped, run twice; a fail disables Automatic on the three tool areas. For plans and questions: a JudgeBench-style slice of pairs; a fail disables Automatic on those two areas. Forty items gives about plus or minus 10 points, enough to reject a bad reviewer and not enough to rank good ones, and the UI says so. No vendor publishes a capability floor; this is the substitute. The check runs on first selection and on request, costs a few thousand tokens, and its result is kept with the model entry.

**Cost and latency.** No vendor publishes a reviewer latency figure. On local hardware a 4k-token tool-call review without thinking is about a second on a 4090 and about four on an M4 Max for a 20B-class model; a second local model costs VRAM or a swap, which is why the local default is the worker itself in a separate request. Reviewer calls count against Loop's token budget. The Settings card says what each job sends off the machine.

**What it never is.** A guard model (Llama Guard, ShieldGemma, Qwen3Guard): recall on agent trajectories is far too low. A model below the worker's tier for plans or questions. A model fed the worker's own account of what it did.

### What "File edits" reviews

The unit of review is a change you can keep or revert, and it depends on the turn:

- In an Agent turn you are watching, it is each edit, shown as a diff in the editor as today.
- In a Loop item, it is the item's whole diff, shown when the item finishes. The edits are applied as the item works, a snapshot is taken when the item starts, and the review offers keep or revert for the item. The next item starts meanwhile unless it comes `after:` the item under review.

This replaces holding each edit as an inbox approval, which made Edits Manual crawl in Loop. A protected path still asks before the write, in both cases.

### Questions are about who decides

Each question the agent raises names its type, a required field on `ask_question` and `hold_question`:

| Type           | Covers                                                                                                                                        | Axis        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `access`       | Something only you can supply: a credential, a login, the output of a command the agent cannot run, a decision only you have standing to make | consequence |
| `irreversible` | Deleting, publishing, migrating, anything hard to undo                                                                                        | consequence |
| `security`     | Credentials, permissions, exposure                                                                                                            | consequence |
| `cost`         | Spending money or a large share of a budget                                                                                                   | consequence |
| `scope`        | What to build, add or drop                                                                                                                    | intent      |
| `design`       | Architecture, libraries, approaches, interfaces, data flow, migration strategy                                                                | topic       |
| `detail`       | Naming, formatting, small defaults; anything not above                                                                                        | topic       |

The agent picks the type by what a wrong answer would cost, and a question on two axes takes the consequence type. `access` is new: a third of the real stops in Anthropic's data are credentials and diagnostics, which no level can hand to the agent or a reviewer, and the old list had no word for them (`research-questions.md`). It is on nobody's list and always reaches you, even at IDGAF, where it is the one question that still does (the agent cannot invent a password).

Two lists, and each level consults the lists the way the tool levels consult rules:

- **You decide** (default: `irreversible`, `security`, `cost`): a floor. Permissive and Automatic honour it; Cautious and Manual send everything to you anyway.
- **Agent decides** (default: `detail`): an allowance. Cautious and Automatic honour it; Permissive lets the agent decide more than that anyway.

For a question:

1. `access`: you, at every level.
2. IDGAF: the agent decides.
3. Manual: you decide.
4. Cautious: the type is on "agent decides": the agent decides. Otherwise you decide.
5. Permissive: the type is on "you decide": you decide. Otherwise the agent decides.
6. Automatic: "you decide" and `scope` send it to you, "agent decides" to the agent, and the reviewer answers `design` and `detail`; unsure or any failure sends it to you. The reviewer has no more information about your intent than the agent, so it is not asked about scope.

A missing or unknown type counts as "you decide" at every level but IDGAF.

**A plan turn has a third way out.** Its fallback rule ("if you cannot ask, take your pick and write it as an assumption") made Mistral Large 3 decide a choice the person had reserved in 3 of 3 runs and Haiku 4.5 in 1 of 3 (`research-plan-ask-models.md`). So a choice the person kept for themselves, or one on the consequence axis, is neither asked nor assumed: it goes to `present_plan` as a `decision`, with the options, the pick, its type and the to-dos that wait on it. A decision is not a to-do (no check, no status); it is written in the plan file under "Decisions", where the person answers it, and the CLI asks each one before the Build question. In `cn serve`, where nobody is at a question box, a plan turn keeps `ask_question`: the question is held in the inbox (`/state` `pendingQuestions`, answered with `POST /message { answerQuestion, answer }`) and the agent goes on with its pick, so a model that wants to ask still presents its plan (built 2026-11-08).

The levels differ most on `design`, which is the single largest class of real agent stops (35% in Anthropic's data), so Cautious and Permissive are far apart in practice even though they differ on few types. The dropdown says that: "Cautious: you decide design and scope questions, the agent decides details."

When the agent decides, the question never reaches you as something to answer. The record is structured, taken from the tool call (type, options, the option chosen, the assumption text), and shown in the inbox and the end-of-run report; it is never left to the agent's prose summary, which is where false claims of success live (`research-questions.md` S1, S2). The agent is told to go on.

**The label is the agent's, so it is checked.** The evidence says a self-report that lets the agent continue drifts toward continuing, and that every shipped design where the model flagged its own action as safe has been exploited (Cline's `requires_approval`). So the label never on its own moves a question off your list. Four checks, in cost order:

- A lexical floor: a question whose text names deleting, dropping, force-pushing, publishing, deploying, migrating, credentials, tokens, secrets, spending, or asks you to supply something, is raised to `irreversible`, `security`, `cost` or `access` whatever type it was given, and the raise is shown on the question.
- A tool floor: a question held while a tool call in the same item touched a protected path or a deny rule is raised to `security`; one held while a re-plan is adding to-dos is raised to `scope`.
- At Automatic, the reviewer classifies the question blind to the agent's label and rationale, with the cost of a wrong answer and the cost of asking stated in its prompt (the framing that raised decision accuracy from about 63% to about 83% in the Act or Escalate study). Disagreement with the agent's label sends the question to you.
- A record: every agent-decided question is listed with its type, and your later overrules are counted per type. That overrule rate is the measure of whether the agent labels honestly; if it climbs for a type, that type moves off "agent decides".

### Inbox or Wait

Who decides is one setting. Whether work stops meanwhile is another, next to the level on the Questions control:

- **Inbox** (default): the question is held and work that does not depend on the answer goes on.
- **Wait**: it must be answered before anything else runs. In Loop the run pauses at the end of the current turn.

Both apply to anything waiting on you, approvals included.

With Inbox, what waits follows from two things the harness already knows:

- the question's `kind`: `assumption` means the item goes on with a stated default and is redone if the answer overrules it; `blocking` means the item cannot finish and reports `waiting`;
- the plan's `after:` dependencies: an item that comes after a waiting item waits too (today's `waitsOnPerson`).

So "does this block the next task?" is answered by the plan, not by the agent or a reviewer: the next task is blocked exactly when it comes after this item and the question is blocking. There is no `blocks` field. Dependency inference is the weakest measured planning skill (edge accuracy trails node accuracy by 15 to 20 points on every benchmark in `research-deferred-input.md`), and every product that lets the model declare dependencies does it once, at plan time, with the harness owning the structure. The one judgment left to the agent is `kind`, a binary the detector-plus-executor studies do well; at Automatic the reviewer checks it and whether the stated assumption is safe, and its answer wins. A `kind: assumption` with no assumption text counts as blocking.

"Make this a subtask" is covered by outcome `waiting`: the item does what it can, parks, and runs again with the answer, checking what is already done. A separate "defer this part as its own to-do" action is Roo's `new_task` and Cursor's Split PRs, both human-approved by default; if it is added later it is a plan edit made from an act turn and goes through the Plan edits level, not under Questions. It is not in the first version.

**What a late answer redoes.** An answer that overrules an assumption redoes the whole item, since cheap "is the result equivalent" checks are near random for code. It also marks every later item that comes `after:` it, or that ran after it and read its notes, as suspect: their checks run again and a failed check redoes them. It never restarts from the question (a full restart wastes about 14 times the work for the same quality). The answer is bound to the item id and the snapshot it overrules, so a resumed run cannot revive the old assumption.

**Two caps on running ahead.** While an item has an open assumption question, a tool call that a built-in protection or a deny rule flags asks even at Permissive: nothing hard to undo runs on a guess. And when the open assumption questions across the loop reach a small settable number (default 4, the per-item limit that already exists), the loop pauses at the end of the item as if Wait were set, because every open assumption multiplies what a late answer redoes.

**Answering.** Each question has one id and ends in exactly one state: answered, confirmed, dismissed, obsolete (the item was dropped) or overruled. An answer that arrives after the item finished shows what it will redo before it is applied. Codex shipped non-blocking questions without this and drew three issues in a month on the answering side alone.

Outside Loop, a question is asked with `ask_question`, which is synchronous. The Questions level still decides who answers it (you, the reviewer, or the agent's own default). Inbox delivery outside Loop is a follow-up. There is no timed auto-answer at any level: Claude Code shipped one and made it opt-in and off within days.

### Modes are sequences of turns

- **Agent:** act.
- **Plan:** plan, then stop. Build is you starting an act turn.
- **Loop:** plan, act, act, plan, act, until the strategy or a budget ends it. Started from a plan card you approved with Build in a loop, it begins at the first act turn.

A turn behaves according to its type, whichever mode launched it. A re-plan is a Plan turn, with Plan's read-only rule. An item run is an Agent turn, under Tool use and File edits. The same system message serves a turn type on every surface. The model per mode already exists (`modeModels`); the research on planner-executor systems says a weak planner hurts more than a weak executor, so the Loop settings say which model takes plan turns and the reviewer, and it may be the capable one while items run on the cheaper one.

The **Plan edits level is checked in one place**: the handoff from a plan turn to an act turn. Plan has no act turn after it and Agent has no plan turn before it, so the level has nothing to do in either. The control is greyed out outside Loop.

The first plan of a Loop started from a prompt is a handoff too. At Cautious it waits for you: misread intent is the largest correctable failure in the 20,574-session study, the first plan is the cheapest place to catch it, and Cursor, Kiro and Anthropic's harness all gate before building. Today's Loop starts its first plan without waiting, so this is a behaviour change for existing Loop users and the migration says so. A Loop started from a plan card has already had its first plan approved by Build and does not wait again.

Three settings stay separate:

- the **mode** says which phases exist;
- the **strategy** (Finish, Check in, Fix forward) says when Loop goes back to planning;
- the **Plan edits level** says who approves going from a plan turn to acting.

A plan turn can also be requested by the item itself: `finish_item` gains the outcome `replan`, for an item that finds the plan is wrong rather than just itself. Asking for more oversight is the safe direction to trust the agent in. It costs a round like any other re-plan, is counted by the budgets, and is limited to 2 per item. The harness also triggers a re-plan on its own when an item hits the repeat limit a second time or a round finishes nothing, since the most common failure in planner-executor systems is a worker repeating an unproductive action without ever asking to re-plan.

**Growth is measured by identity, not text.** The harness owns to-do ids. `present_plan` in a re-plan carries the id of each kept to-do, so a reworded to-do is a change and not new work; a to-do with no id is new. A split of a failed item counts as one new to-do beyond the first child, and a new to-do that names a failing check does not count at all, since fixing a failed check is the growth a re-plan exists for. The plan also has a run-wide ceiling (the task list's maximum) that no re-plan exceeds at any level but IDGAF, so Permissive cannot add five per re-plan indefinitely. No evidence supports 5 as the per-re-plan number; it stays as a setting. At Automatic the reviewer judges the diff by id, not the count.

Loop keeps only what is about scheduling: choosing the next item, strategy, budgets, the per-item prompt and `finish_item`, and the inbox.

Loop's old levels split up: the re-plan rule moves to Plan edits, the question rule to Questions, budgets become plain Loop settings starting at `DEFAULT_LOOP_BUDGET`, and Unattended's 15-minute timeout goes away. A question waits until it is answered, or is never asked under IDGAF.

## Decision order

For a call in a given area:

1. An organisation ceiling caps the level (see "Settings"). Nothing below raises it.
2. The tool is switched off: off. Nothing overrides this.
3. A hook (CLI) says deny or ask: it tightens. A hook's allow counts as an allow rule. Hooks are the user's own programs, not rules, so they run at every level.
4. Level is YOLO: run. Rules, built-ins and the reviewer are not consulted.
5. A deny rule matches any part: refused, and the agent is told and carries on.
6. An enabled built-in refuses (safety check) or asks (protected path).
7. An ask rule matches any part: ask.
8. Level is Manual: ask.
9. Every part matches an allow rule from a trusted source: run.
10. The level decides:
    - Cautious: the tool's own result stands (its setting, the safe-command check).
    - Automatic: as Cautious, and a call that would ask goes to the reviewer. Allow runs, deny refuses, unsure or any failure asks.
    - Permissive: run.

Deny beats ask beats allow, regardless of how specific a rule is or where it is written. Compound commands keep today's handling: any part can deny or ask, every part must be allowed, and a command the parser cannot follow is never allowed by a rule. A command the parser cannot follow is also never run at Permissive: it asks, and the result tells the agent to rewrite it as one plain command.

Tools that only touch the session (TaskList, PresentPlan, FinishItem, HoldQuestion, RemindMe and so on) are not in any area and are never asked about. AskQuestion and HoldQuestion are governed by Questions.

**Refusal cap.** After 3 refusals in a row, or 20 in one turn, from any source, the turn ends as "needs you" with the refused calls listed. At Permissive a refusal will not change on retry, so the cap is what stops a loop of attempts.

## Which area a call belongs to

Context use is about what only reads, however it reads. A read-only command counts as Context use, the same as a read-only tool, so `git log` is decided by the Context level and not the Tool use level. What sends it there is being sure that it only reads. There are two outcomes, and a claim that travels with the call:

| Outcome                | Means                                                                                                                                                                                                                                                                                                                                                                                                | Area        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Read-only, vouched** | A command the parser fully understood (every element a literal word or quoted string; no substitution, no redirect except to `/dev/null`, no glob where the command can write, no unknown environment prefix, no UNC path, under 10,000 characters), every part of it on the read-only list with its arguments checked. Or an MCP tool marked `readOnlyHint` by a server the user has marked trusted | Context use |
| **Not vouched**        | Anything else                                                                                                                                                                                                                                                                                                                                                                                        | Tool use    |

The **claim** is what the chip and the reviewer see: who judged (the parser, the MCP server's hint), what it says (read-only), whether it was vouched for, and if not, why ("argument `--output` not recognised", "server not trusted"). This replaces the three confidence levels in the earlier draft: no vendor ships a third level, because the middle band is exactly what every one of them sends to a prompt; what is useful about it is the fact to display, not a level (`research-readonly-and-leaks.md`, section 16).

Confidence belongs to whoever judged the call. The reviewer at Automatic decides run or ask within Tool use; it never promotes a call to Context use, where a Permissive level or a plan turn would run it without rules. Its misses are structural (what it is not shown) and its verdicts move with prompt wording, so it is not trusted to move a call between areas.

Being unsure counts against running, on both sides:

- **The allow side (Cautious).** A call runs only if we are sure a rule covers it. Unsure means not covered, and it asks.
- **The deny side (Permissive).** A call runs unless a deny applies. Unsure whether one applies counts as applying, and it asks rather than being refused.

**The read-only list** starts narrow and checks arguments; section 15 of `research-readonly-and-leaks.md` is the starting list, with per-command refusals copied from Codex and Claude Code (`find` without `-exec`, `-delete` or `-fprint`; `rg` without `--pre`; `sed` only as `-n ...p`; `sort` without `-o`; `jq` without file-reading flags; `file` without `-m` or `-f`; `ps` without `e`). `awk`, interpreters, `xargs`, `eval` and `source` are never read-only. Anything that contacts the network is not read-only, including `gh pr view`, `git fetch` and `curl`: the one time a vendor allowed DNS lookups, an injection exfiltrated `.env` over DNS (CVE-2025-55284). PowerShell has its own cmdlet list behind parse-tree conditions, cmd has a minimum, and a command for a shell the parser does not know is not vouched.

**`git` reads run things.** `git status`, `git diff`, `git show` and `git blame` run `core.fsmonitor`, hooks and clean filters from the repository's own `.git/config`; this was exploited across seven agents in 2026 (GitSpawn). A read-only `git` entry therefore always injects `-c core.fsmonitor= -c core.hooksPath=/dev/null -c core.pager=cat --no-ext-diff --no-textconv`, refuses the global flags that change what runs (`-c`, `-C`, `--exec-path`, `--git-dir`, `--output` and so on), and before the first git read in a repository scans `.git/config` and its includes for `fsmonitor`, `hooksPath`, `hook.`, `filter.`, `diff.external`, `textconv` and `sshCommand`; if any is present, git is not vouched in that repository and the chip says why.

**MCP hints need trust, not provenance.** The MCP specification says clients must treat annotations as untrusted unless the server is trusted. "Not loaded from a workspace file" is where the config came from, not a trust decision. So the hint moves a tool to Context only for a server the user has marked trusted in a dialog (the one Claude Code shows before using `.mcp.json` servers is the model), whatever file configured it. For every other server the hint is a label on the prompt and in the claim, and the tool is Tool use. This tightens the commit `bbaba3dee` behaviour, which keyed on provenance.

A vouched read-only command also runs in a plan turn, which is what lets a re-plan look at `git log` or `git diff`. Plan's read-only rule is unchanged.

**Commands that read or write named files are checked against the file rules.** The parser extracts the files a read-only command names (`cat`, `head`, `tail`, `sed -n`, `grep` on a file) and matches them against the Context area's deny and ask rules and the protected paths, so a Context deny on `.env` stops `cat .env`. It extracts the paths a command would write (redirect targets `>`, `>>`, `2>`, `tee`, `sed -i`, and the targets of `mv`, `cp`, `rm`, `touch`, `mkdir`, `git checkout --`) and matches them against the File edits area's deny and ask rules and the protected paths. A hit tightens the call. This never loosens: an allow rule on an edit path does not make a command run. Claude Code ships this check and says itself what it misses: `grep -r` from inside a directory, scripts and interpreters that open files, writes by flag (`git diff --output`, `rg --pre`), other spellings of a program, and anything behind `$()`. It closes the accidental case, not the adversarial one.

What it does not close, the controls say: when Tool use is looser than File edits, the File edits control shows "commands can still write files"; when Tool use is looser than Context use, the Context control shows "commands can still read files"; the Tool use Permissive and YOLO lines repeat it. The `sandbox:` key is reserved beside `levels` in the settings file now, so that adding a sandbox later never changes what a level means (Cursor's allowlist-replaced-by-sandbox complaint). On Windows the text check is the only layer most users will have for some time: Claude Code runs native Windows unsandboxed, VS Code dropped Windows sandboxing for local sessions, Cursor's runs inside WSL2, and only Codex ships a native one on recent Windows 11 builds.

## Built-in rules

Protected paths and the safety check become rules you can see and switch off, by id. Cautious, Automatic and Permissive honour them; YOLO ignores them.

| id                          | Effect | Covers                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protect-secrets`           | ask    | Credentials and key files, for every tool and command, including the files a command names and redirect targets. Default patterns from the sandbox runtime's deny list: `.ssh`, `.gnupg`, `.aws`, `.azure`, `.kube`, `.docker`, `.config/gh`, `.git-credentials`, `.netrc`, `.pypirc`, `.cargo/credentials.toml`, browser and password-manager stores                                   |
| `protect-config`            | ask    | Things that change what runs later, for writes and commands: the current list plus Claude Code's (`.gitconfig`, `.gitmodules`, shell rc files, `.npmrc`, `.yarnrc*`, `bunfig.toml`, Bazel rc files, pre-commit and lefthook configs, wrapper properties, `.devcontainer.json`, `.mcp.json`), this product's own config, permissions and plans directories, and Cursor's `.cursorignore` |
| `protect-network-paths`     | ask    | UNC paths, which contact another computer                                                                                                                                                                                                                                                                                                                                               |
| `refuse-dangerous-commands` | refuse | Commands the safety check refuses. Evaluated on the raw text as well as the parsed parts, so a parse failure never skips it                                                                                                                                                                                                                                                             |
| `plan-keeps-checks`         | wait   | A re-plan that changes a failing check or drops a finished item. Waits at every level but IDGAF, which lists it in the end-of-run summary                                                                                                                                                                                                                                               |

Two things are not switchable:

- **Writes to the policy itself** (`~/.continue/permissions.yaml`, `toolPermissions` in `config.yaml`, the `.continue` and `.claude` directories) ask at every level but YOLO. A repository or the agent must not be able to turn this off.
- **YOLO and IDGAF are never read from disk.** They are set from the picker or a flag and last for the session (see "Settings"). So an agent that writes `yolo` into the policy file changes nothing for the next session.

Built-ins are stored as switches by id, never copied into your file, so new built-ins arrive with updates and nothing is lost by omission. Switching one off is how a false alarm such as `\\w.py` gets fixed.

## YOLO

YOLO approves everything: no rule, built-in or reviewer is consulted. This is by decision. Three things still bind, because they are not approval:

- a tool that is switched off stays off;
- an organisation ceiling (below);
- hooks, which are the user's own programs.

The dropdown line says so and counts the deny rules YOLO will ignore. Optionally, for a user who wants one hard line while keeping YOLO's meaning everywhere else, the settings file takes a `floor:` list of deny rules that bind at every level including YOLO. It is empty by default and never written by anything but the person, so YOLO's default behaviour is exactly "approve everything".

## Settings

One file, read by the IDE and the CLI: `~/.continue/permissions.yaml`. The IDE's saved state mirrors it and writes through it, so the two surfaces never disagree.

```yaml
levels:
  context: permissive
  tools: cautious
  edits: manual
  plan: cautious # yolo here is ignored on read: session-only
  questions: cautious # same
plan:
  maxNewItems: 5
questions:
  delivery: inbox # inbox | wait
  youDecide: [irreversible, security, cost]
  agentDecides: [detail]
builtin:
  protect-network-paths: off
floor: [] # optional deny rules that bind even at YOLO
mcpServers:
  github: trusted # a server's readOnlyHint moves tools to Context only when trusted
# sandbox: reserved for later; never changes what a level means
```

Rules stay where they are (`toolPermissions` in config.yaml, `allow`/`ask`/`exclude` in the CLI's file).

**Scope and lifetime.** Levels are per user. YOLO and IDGAF are per session: they are not saved, and a saved value of `yolo` is read as that area's default with a notice. A change takes effect as a snapshot per turn: a tightening applies at the next tool call, a loosening from the next turn, except that it may answer a prompt already waiting.

**Repository files cannot set levels, presets, lists, built-ins or the floor.** They are read from user settings only. A repository that tries is ignored with a notice naming the keys.

**Repository files cannot add allow rules or reviewer guidance without trust.** Today `.continue/*.yaml` blocks in the workspace are merged into the config and `toolPermissions.allow` lists are concatenated, so a cloned repository can allow anything and write the reviewer's "fine to allow" guidance. Each rule carries its source. `deny`, `ask` and `exclude` from a workspace file apply at once. `allow` and `auto.guidance.allow` from a workspace file apply only after a dialog that lists the exact rules, keyed to a hash of the file so a change asks again; until then they are ignored with a notice. This is the mistake behind CVE-2025-53773 and the later VS Code report, and the Cursor MCPoison report is why the trust is keyed to the file's content.

**Organisation ceiling.** An organisation's config may set `ceiling.<area>: <level>`. A level above the ceiling is shown as capped, and YOLO within a ceiling runs at the ceiling. It is the one thing that binds at YOLO besides tools switched off and hooks.

A level that does not exist for an area, or an unknown name, falls back to that area's default and reports it. Nothing silently does nothing.

### Presets

A preset writes the five levels and nothing else; rules are untouched. Anything else shows as Custom.

| Preset       | Context    | Tools      | Edits      | Plan       | Questions  |
| ------------ | ---------- | ---------- | ---------- | ---------- | ---------- |
| Careful      | Permissive | Cautious   | Manual     | Cautious   | Cautious   |
| Accept edits | Permissive | Cautious   | Permissive | Cautious   | Cautious   |
| Hands off    | Permissive | Permissive | Permissive | Permissive | Permissive |
| Reviewer     | Permissive | Automatic  | Automatic  | Automatic  | Automatic  |
| YOLO         | YOLO       | YOLO       | YOLO       | IDGAF      | IDGAF      |

Reviewer leaves Context at Permissive: a reviewer on in-workspace reads costs a call per read for nothing, and every comparable tool skips them.

### Migration

Saved settings are normalised on read and not rewritten until you change something. Equal or stricter, never looser. Every value that changed is reported once.

| Old                                             | New                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manual                                          | Careful                                                                                                                                                                                                            |
| Auto-approve                                    | Careful, then each switch: read files → Context Permissive; edit files → Edits Permissive; run all commands → Tools Permissive; browser and MCP stay under Tools at Cautious, with per-tool settings carrying them |
| Auto                                            | Reviewer, for Tools; the rest as Careful                                                                                                                                                                           |
| Review                                          | Context and Tools Permissive; the rest as Careful                                                                                                                                                                  |
| YOLO                                            | The same as Review. A saved `yolo` comes from 2.4.4, where YOLO still honoured deny rules and protected paths, so carrying it over as today's YOLO would loosen it; and YOLO is now session-only in any case       |
| A per-tool "run without asking" on an edit tool | Edits Cautious (the setting becomes an allow rule for that tool)                                                                                                                                                   |
| Loop level on a saved session                   | Ignored; the levels in force apply. Note: at the default Plan Cautious, a Loop started from a prompt now waits on its first plan, where before it did not; the first run after upgrading says so once              |

Only `manual`, `autoApprove`, `auto` and `yolo` shipped in 2.4.4. Review and Loop's levels need handling only for development builds.

## Interface

**IDE.** The user's decision is five icons in the input toolbar, one per area, each with a dropdown of its levels. The evidence in `research-controls-ux.md` is against that shape: no shipping agent uses state icons for this, icon-only controls lose on learning and retention in the one controlled study, both vendors that shipped a per-area grid collapsed it at sidebar width, and five 24 px targets with gaps take 152 px of a 300 px toolbar before the model picker and send. The research supports one labelled picker instead, and the review asks the user to choose. Both shapes are specified here so either can be built:

- _Five icons (decided):_ each icon shows its level with a fill mark as well as colour, and its tooltip is a plain sentence naming who decides ("Tool use: runs what your rules allow, asks you about the rest"). Clicking one opens a dropdown of its levels, with a header line, one line each on what that level does in that area, and the reviewer line's caveat. Presets live in one place, the first icon's dropdown or a Settings page, not in all five: Roo's history with a global switch beside per-area toggles is a record of state bugs.
- _One picker (recommended by the evidence):_ a labelled control showing the preset name or Custom, red when any area is at the top level. Its popover lists the presets first and the five rows beneath, each row a dropdown as above. The tooltip and status line show only the rows that differ from the preset.

In either shape, an area at the top level turns the control red, replacing the YOLO banner. Settings gets a page for the same five rows, plus the built-in rules, the question lists and the floor. The File edits control shows the "commands can still write files" note when Tool use is looser than it.

**The label IDGAF.** The user chose it for the top level of Questions and Plan edits. The evidence against it is specific: the Visual Studio Marketplace terms bar offensive content and Microsoft scans listings, Open VSX's terms bar profanity, the acronym expands to an expletive and does not localise, and comparable jokey labels (Chromium's download-recovery button, Firefox's about:config warning, Cursor's YOLO) were all renamed once the audience widened. The review asks the user to decide; the alternative is "Everything" or "Agent decides everything" with the red icon carrying the warning, and YOLO kept as the CLI alias for the preset.

**Always allow.** Cautious is only usable if rules are easy to make. From a prompt or the inbox: "Always allow `npm test`" writes a command rule; "Always allow edits in `src/**`" writes an edit rule; "Always let the agent decide `detail` questions" adds the type to the list. The rule is shown before it is saved, and only the one-time option is offered when the rule cannot be shown.

**Attention.** A held question or approval fires one OS notification on the state change, not on a timer, and nothing while the window is focused.

**CLI.** `--context`, `--tools`, `--edits`, `--plan`, `--questions` take a level; `--policy` takes a preset. `--auto` becomes `--policy yolo`. `--readonly` still starts in Plan mode. A `/policy` command shows and changes them. Headless (`cn -p`) has nobody to ask: every ask becomes a refusal the agent can read, "agent decides" questions are decided, and a "you decide" question ends the run as "needs you" with the question in the output. Today's headless default of allowing every tool becomes an explicit `--policy`, not a hidden default.

**cn serve.** The state reports the levels, and a `policy` message changes them. `loopAutonomy` goes away. The server binds to `127.0.0.1` by default; `--host` widens it and then requires `--token`, and without a token a remote `policy` message may only tighten. Questions are delivered to the serve client's inbox, so Inbox works there.

**Subagents.** A subagent's calls are decided by the same levels. In an Agent turn its asks show on its card; in a Loop item they are held like the item's own. Subagents do not ask questions; they report to the parent.

## Accountability

At the end of a Loop run, and as a summary chip after an Agent turn, a report lists: rules that were not consulted (YOLO), questions the agent or the reviewer decided and what they chose, checks a re-plan changed, calls refused and by whom, and the snapshot to revert to. Loop takes a `git stash create` snapshot at the start of each item (the L6 proposal) so revert is per item.

The reviewer's calls count against Loop's token budget: they are tokens spent on the run. The reviewer prompt is a fixed prefix plus the call, so it caches like any other request.

Measured locally, shown in the report, never sent anywhere: prompts per task, level changes within a session, the overrule rate of agent-decided questions by type, time from a held question to its answer, and refusal-cap stops.

## Where this differs from the research

Full notes: `ux-policy-matrix.md` and the `research-*.md` files in the session notes. No shipping tool has a per-area level enum, so this is new ground.

Taken from it: deny, ask, allow with no specificity; built-ins switched by id; levels never read from a repository; presets that only set levels; normalise on read and never loosen; unsure and failure both ask; refusals tell the agent; web and MCP under Tools with the reviewer limited to what would have asked; redirect targets and named files checked against file rules; two read-only outcomes with a displayed claim instead of three levels; MCP hints trusted per server, not per file; git reads with injected overrides; higher autonomy expires; trust keyed to the file's content; the reviewer blind to the agent's label; questions recorded from the tool call rather than the summary; dependencies owned by the plan rather than claimed at question time.

Not taken, on purpose:

- **YOLO keeps your deny rules.** Claude Code, Zed and Devin all do this, and the research recommends it. We don't: YOLO is defined as ignoring every rule, by decision. The dropdown says so and counts the deny rules it will ignore. The optional `floor:` list is there for a user who wants one hard line and says so.
- **Three levels on Plan and Questions.** Both keep all five. On Plan, Cautious and Permissive have clear meanings (no new to-dos, at most N); on Questions, the two lists give Cautious and Permissive something to match on.
- **No reviewer on in-workspace edits.** Vendors skip them, but that path is where the published misses are, and the user asked for a reviewer that accepts edits. It reviews the edit as a tool call, the same as everything else.
- **`overrides` for MCP or web.** Not in the first version; per-tool settings and rules cover it.
- **A sandbox axis.** Separate work. The write-target check and the note on the File edits control are what stands in for it meanwhile.

## Build order

1. Core: `core/tools/permissions/policy.ts` (areas, levels, presets, labels, migration, built-ins, floor, question lists), `decideToolCall` and `evaluateToolPolicyWithRules` take it in place of `ApprovalSettings`; rule sources and the workspace-allow trust check in config loading; the read-only classifier and the write-target check in the command parser; `core/llm/prompts/turns.ts`. `core/util/loopMode.ts`: `planHandoff` replaces `replanDecision`, `LOOP_AUTONOMY` goes away, ids on re-plans, `replan` outcome. Reviewer prompts for plans and questions beside the tool-call one.
2. IDE: state and migration from the shared file, the five icons, the handoff, item-level edit review with snapshot, `ask_question`, Questions routing and the lexical floor, the report, Settings.
3. CLI and serve: the shared file, flags, `/policy`, the same handoff, headless rules, serve binding and token.
4. Tests in each, then a Windows Sandbox run and the Nova scenario suite with the new scenarios in `policy-areas-prompts.md`.
