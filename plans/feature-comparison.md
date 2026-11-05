# Feature comparison

Last updated: 2026-11-03.

How Continued compares with other coding-agent harnesses, and what to build next. Sources are each tool's public docs, read on this date, and this repository's code.

Legend: **yes** means a docs page or code for it was seen. **?** means believed to exist but not seen. **no** means it was not in the docs read; that is not proof it is missing. Windsurf, Copilot, Gemini CLI, Roo, Kilo, Amp and OpenCode were not researched.

## Comparison

| Capability                 | Continued                                                                                                  | Claude Code                              | Cline                                                            | Cursor                | Codex CLI          | aider                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- | --------------------- | ------------------ | ----------------------- |
| IDE extension              | yes: VS Code, JetBrains                                                                                    | yes: VS Code, JetBrains, desktop, web    | yes: VS Code, JetBrains, ACP editors                             | is an IDE             | yes                | via file comments       |
| Terminal CLI               | yes: `cn`                                                                                                  | yes                                      | yes                                                              | yes                   | yes                | yes                     |
| Inline autocomplete        | yes                                                                                                        | no                                       | no                                                               | ?                     | no                 | no                      |
| Plan mode                  | yes                                                                                                        | yes                                      | yes                                                              | yes                   | ?                  | architect and ask modes |
| MCP                        | yes, with remote OAuth                                                                                     | yes                                      | yes                                                              | yes                   | yes                | no                      |
| Instruction files          | yes: rules, `AGENTS.md`, `AGENT.md`, `CLAUDE.md`                                                           | yes: `CLAUDE.md`                         | yes: rules                                                       | yes: rules            | ?                  | conventions file        |
| Skills                     | yes: `readSkill` tool in core and CLI                                                                      | yes                                      | yes                                                              | yes                   | yes                | no                      |
| Subagents                  | beta in CLI (`--beta-subagent-tool`); none in IDE                                                          | yes                                      | CLI and Desktop only                                             | yes                   | yes                | no                      |
| Hooks                      | written in CLI, **not called**; none in IDE                                                                | yes                                      | via SDK plugins                                                  | yes                   | ?                  | no                      |
| Plugins or marketplace     | no                                                                                                         | yes                                      | yes                                                              | yes                   | yes                | no                      |
| Checkpoints or rewind      | no (only an external `git-ai` attribution call)                                                            | ?                                        | yes                                                              | ?                     | ?                  | via git commits         |
| Permission modes           | per-tool policies; Auto reviewer in progress                                                               | six modes, classifier-reviewed auto mode | auto-approve, YOLO                                               | ?                     | `/permissions`     | n/a                     |
| OS sandbox                 | no                                                                                                         | yes: bash sandbox                        | no                                                               | ?                     | yes                | no                      |
| Cloud or background agents | no                                                                                                         | yes                                      | yes                                                              | yes                   | yes: `codex cloud` | no                      |
| Headless or CI             | yes: `cn -p`                                                                                               | yes                                      | yes                                                              | yes                   | yes                | scripting               |
| Scheduled runs             | no                                                                                                         | ?                                        | yes: cron                                                        | yes: automations      | no                 | no                      |
| Code review                | `cn review`, `cn checks` (hosted API)                                                                      | yes                                      | PR review sample                                                 | yes: Bugbot           | yes                | no                      |
| Parallel agents            | no                                                                                                         | yes                                      | yes: Kanban, agent teams                                         | yes                   | yes                | no                      |
| Cross-session memory       | ?                                                                                                          | yes                                      | yes: Memory Bank                                                 | ?                     | ?                  | no                      |
| SDK                        | no                                                                                                         | yes                                      | yes                                                              | yes                   | yes                | Python scripting        |
| Task list tool             | `Checklist` (CLI only): the list lives in the transcript and is lost to compaction; see `task-planning.md` | to-do checklist, Ctrl+T                  | Focus Chain page not found; docs suggest a todo list in planning | not in the pages read | ?                  | no                      |
| Language-server tools      | no (grep, glob, repo map)                                                                                  | yes                                      | ?                                                                | ?                     | ?                  | repo map                |
| Prompt cache controls      | yes: toolbar, cold-cache, miss, caching-off notices                                                        | prompt caching page                      | ?                                                                | ?                     | ?                  | yes: prompt caching     |

## Notes from reading the code

- Hooks: about 1,500 lines in `extensions/cli/src/hooks` cover 17 events, six settings files and command and HTTP handlers. Nothing imports `fireHook.ts`, so no hook ever runs. See `hooks-wiring.md`.
- Subagents: `tools/subagent.ts` and `subagent/executor.ts` exist. The executor was not read, so how a subagent is approved is unknown.
- Cline's subagents: approving the `spawn_agent` call approves everything the subagent does, and approval settings do not apply inside it. Avoid that design.
- Checkpoints: the only match for "checkpoint" in the CLI is a call to the external `git-ai` tool for authorship tracking.

## What to build

In order of value for an enterprise fork that leans on Bedrock:

1. Wire the CLI hooks, with a trust check and fail-closed behaviour. Plan: `hooks-wiring.md`.
2. Checkpoints and rewind for file edits. Already under "Later" in the roadmap.
3. Hooks in the IDE, once the runner is shared with `core`.
4. Subagents out of beta, after reading the executor's approval behaviour.
5. A task list that survives compaction (Track F). A `Checklist` tool exists in the CLI but is not held outside the transcript.
6. Headless and CI polish, and an OS sandbox for regulated users.

Skipped for now: plugin marketplace, cloud agents and Kanban-style boards, which need infrastructure this fork does not have.
