# Roadmap

Last updated: 2026-11-03 (at `origin/main` dac210ad3, after #121).

This is the place to check what is done, what is in flight and what comes next. `fork-plan.md` stays as the original design record (why we forked, scope, risks, licensing, CI). Detailed plans for new work live next to this file.

## Shipped

PR numbers are from `b1tninja/continued`, read from `git log` and `gh pr list`. Nothing here is aspirational.

| Area | What works now | PRs |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----- |
| Remote MCP servers | OAuth sign-in for `streamable-http` and `sse`; tokens kept in the IDE's secret storage | #7, #14 |
| Enterprise TLS | Proxy, CA bundle and system CA store for MCP servers and for Bedrock requests | #5, #8 |
| Amazon Bedrock | Add-model wizard with a connection test and model discovery; bearer-token auth for API keys; clearer access-denied hint; one model list across the standard and Mantle endpoints | #2, #81, #90 (includes #91) |
| Bedrock Mantle | `bedrock-mantle` provider | #4 |
| Models | Adaptive thinking for Claude 4.6+; live model lists in the model pickers | #87 |
| Per-mode models | `modeModels:` in config.yaml (one model and a reasoning effort per Chat / Plan / Agent mode); the mode menu shows which model each mode uses. A1: `modeModels.<mode>.models` lists and GUI saves that keep comments and key order in config.yaml. A2: the model picker and `Cmd+'` follow the current mode's list. A3: a Models per mode card and `config/setModeModels` | #3, #106, #108, #109, #111 |
| Missing secrets (A0) | A `${{ secrets.* }}` key that is not set on this machine is reported with a way to fix it, instead of an unrelated authentication error | #98 |
| Tool permissions (B1, B2) | `toolPermissions` allow / ask / deny rules in config.yaml, a rule engine in core and named refusal reasons; an Always allow button that saves a narrow allow rule and then runs the call | #104, #122, #123 |
| Protected paths and command rules | Credential and startup-file paths always ask, file rules ignore case, the prompt says why, risky Always allow is confirmed; commands are read as the shell does (quotes, wrappers, nested scripts) with a regression corpus | #124, #125 |
| Prompt caching (C0-C3) | Bedrock usage recorded, the 5m/1h write split kept, more Claude models priced; a toolbar menu (config default / Auto / 5 minutes / 1 hour / Off) with a warm-or-expired tooltip and a switch-cost notice; breakpoints on tool results and Bedrock cache-isolation fix. Default stays off. See `prompt-caching.md` | #126, #127 |
| Plans | Roadmap and model/provider plan (Track A), tool auto-approval plan (Track B), prompt caching plan v2 (Track C) | #94, #95, #128 |
| Install guide, README, icon | Fork install guide, README rewrite, new icon set | #92 |
| Branding | "Continued" in user-visible VS Code labels | #12 |
| Build, CI and tooling | VSIX build time limit, CI cost cuts, e2e against VS Code 1.144, ripgrep from npm, ESLint 10 flat configs, TypeScript 7, vitest 5, core binary built with `@yao-pkg/pkg` on Node 22; the JetBrains Gradle run is time-bounded so a failing integration test fails instead of hanging | #62-#64, #80-#84, #86, #88, #89, #93, #103 |
| Dependencies | Dependabot updates merged in groups (#112-#121 among them); Dependabot ignores for updates that cannot land yet (Kotlin, kodein-di, OpenTelemetry 0.x, onnxruntime-*) | #99, #100, #102, #107, #112-#121 |

## In progress

Work under way with no pull request open yet. Numbers are added when the PRs exist.

| Item                                 | State                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Setup flow (A4)                      | One reusable setup flow behind the onboarding card, "Manage models" and a command. Not merged.                      |
| Reviewer role and Auto mode (B3, B4) | The `reviewer` model role, the experimental Auto mode, and its evaluation set. Not merged.                          |
| Dependency and vulnerability cleanup | Remaining Dependabot updates and security advisories; rerun the CI gates after major bumps.                         |
| Test reliability                     | Fixing tests that fail or hang in CI.                                                                               |
| Kotlin 2.4 for JetBrains             | The deliberate Kotlin upgrade that the Dependabot ignores for Kotlin and kodein-di wait for.                        |
| Prompt caching documentation (C5)    | Reference for the cache fields and a page on cache lifetime and cost. The default stays off, so C4 has not started. |

## Next

Three independent tracks. They share no code, so different people can build them in parallel. Each track is a series of small PRs, one concern per PR.

### Track A: model and provider setup

Plan: [`model-config-ux.md`](./model-config-ux.md)

Problem: the setup wizard cannot be reopened to edit a configuration; each provider contributes exactly one chosen model; you cannot choose a set of models per mode to switch between quickly; and a config that references a secret not set on this machine fails with an unrelated authentication error instead of pointing at the missing key.

| PR  | Scope                                                                                                                                                                                                                       | Depends on | State              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| A0  | Detect `${{ secrets.* }}` references that are not set on this machine; show a warning indicator on the toolbar triangle and the model gear, with a popover to open `.env` or the config line; stop sending the literal text | none       | Shipped #98        |
| A1  | Schema and core: `modeModels.<mode>.models` list, comment-preserving YAML edits, new setup messages, secret-storage lookup                                                                                                  | none       | Shipped #106, #108 |
| A2  | The chat model picker and `Cmd+'` follow the current mode's list                                                                                                                                                            | A1         | Shipped #109       |
| A3  | Models tab: checkbox table (Chat / Plan / Agent) with a default per mode, plus a Providers card                                                                                                                             | A1         | Shipped #111       |
| A4  | One reusable setup flow (credentials, model checklist, review) behind the onboarding card, "Manage models", and a command; adds "Enter key" to the A0 popover                                                               | A1         | In progress        |

### Track B: tool auto-approval and Auto mode

Plan: [`tool-auto-approval.md`](./tool-auto-approval.md)

Problem: tool approval is a three-way switch per tool, stored in the webview rather than in config. There is no way to say "allow `npm test`, ask for `git push`, never read `.env`", MCP tools cannot be told apart, and nothing judges a command by its effect (for example, whether it touches production).

| PR  | Scope                                                                                                                                             | Depends on | State                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------ |
| B1  | `toolPermissions` rules in config.yaml, a rule engine in core, named refusal reasons, protected paths                                             | none       | Shipped #104, #122, #124, #125 |
| B2  | Approval selector (Manual / Auto-approve / YOLO), Cline-style category toggles, per-server MCP switches, "Always allow"                           | B1         | Shipped #123, #124             |
| B3  | A `reviewer` model role and the optional "Auto" mode that uses it, with deny-and-continue and refusal caps, behind an experimental setting        | B1         | In progress                    |
| B4  | Evaluation set; confirm or change the suggested reviewer defaults; documentation; the experimental flag is removed only if the quality bar is met | B3         | Not started                    |

### Track C: prompt caching controls

Plan: [`prompt-caching.md`](./prompt-caching.md)

Problem: cached prompts expire after 5 minutes by default, so a session that pauses for a long command or a long read re-reads its whole history at full price. There is no switch for it, no way to choose the lifetime, no cost shown, and two placement bugs mean some sessions do not hit the cache at all. Independent of Tracks A and B. C2 is partly shipped: the per-request `promptCaching` and `promptCacheTtl` options exist on Anthropic and Bedrock and an explicit `promptCaching: false` wins, but there is no single policy function, no `cacheBehavior.ttl` in config.yaml, and no Vertex or OpenRouter `ttl`.

| PR  | Scope                                                                                                                                                   | Depends on | State                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------- |
| C0  | Measure: Bedrock usage, the 5m/1h write split, 1-hour price and missing Claude models in the cost table, hit rate against API counts, miss-cause report | none       | Shipped #126                    |
| C1  | Fix cache marker placement for Agent loops (tool results) and Bedrock's rewritten messages                                                              | C0         | Shipped #127                    |
| C2  | One policy function, `cacheBehavior.ttl`, `ttl` sent on Anthropic, Vertex, Bedrock and OpenRouter; default stays off                                    | C1         | Partly shipped #127 (see below) |
| C3  | Toolbar menu (Auto / 5 minutes / 1 hour / Off), warm-or-expired tooltip, switch-cost notice, usage panel                                                | C2         | Shipped #127                    |
| C4  | Default on for Claude models with Auto, after a week of C0 data                                                                                         | C3         | Not started                     |
| C5  | Documentation for the new fields and a page on cache lifetime and cost                                                                                  | C2         | In progress                     |

## Later

Carried over from `fork-plan.md` section 4.7, item 4. None started:

- Checkpoints for file edits, so an Agent run can be rolled back.
- A global rules toggle per mode.
- Context-window and cost display per model.
- Import of Cline's MCP settings file, so servers are not configured twice.

## Open decisions

| Decision | Default used for planning | Needs an owner |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----- |
| Where per-mode model lists live | `modeModels.<mode>.models` in config.yaml | no |
| Which config file GUI setup edits | the global `~/.continue/config.yaml` only (other profiles: open file) | no |
| API key storage | a user setting in the setup flow; default secure storage, else `~/.continue/.env` (see `model-config-ux.md` section 4.5) | no |
| Where tool-approval rules live | config.yaml under `toolPermissions` | no |
| Reviewer model for Auto mode | a user setting: a new `reviewer` model role, unset by default, so Auto stays unavailable until one is chosen (`tool-auto-approval.md` section 7.3) | no |
| Distribution channel for the `.vsix` (fork-plan section 6) | open | yes |

## How to use this file

- Update the "Last updated" line and move rows between sections in the same PR that changes their state.
- Add a PR number only after the PR exists. Do not list planned work as shipped.
- A new plan goes in `plans/<topic>.md` and gets a row under "Next".
