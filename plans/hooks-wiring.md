# Hooks wiring (CLI)

Last updated: 2026-11-03. Status: plan, nothing built.

The CLI has a complete hooks system that nothing calls. This plan wires it into the tool-call path, fixes the places it fails open, and adds a trust check so a cloned repository cannot run commands by shipping a settings file.

## What exists

All in `extensions/cli/src/hooks`, about 1,500 lines with 35 tests:

- `types.ts`: 17 event names and the Claude Code input and output schemas.
- `hookConfig.ts`: reads six settings files (`~/.claude`, `~/.continue`, then project `.claude` and `.continue`, then the `settings.local.json` pair) and appends their hooks.
- `hookRunner.ts`: runs command and HTTP handlers, matches on a regex, de-duplicates, aggregates results.
- `fireHook.ts`: nine helpers such as `firePreToolUse`, built to be called from the stream code.
- `HookService.ts`: registered as `services.hooks`.

`fireHook.ts` is imported by nothing. The permission and execution code (`handleToolCalls.ts`, `streamChatResponse.helpers.ts`, `tools/index.tsx`) never mentions hooks. A hook file today is read and ignored.

## Failure behaviour

Decision: a hook that fails blocks the action by default, and each hook can opt out with `onError: "allow"`. Whether Claude Code tolerates the extra key is not verified; check before documenting that a file can be shared between the two tools.

A hook fails when any of these happen. Today every one of them lets the action through:

| Failure                                      | Today                                                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeout                                      | `close` reports `code: null`, `signal: SIGTERM`, and the runner does `code ?? 0`, so it counts as success. The `execFile` behaviour was reproduced in isolation (500 ms limit on a 5 s command); the runner itself was not run. |
| Command cannot start                         | `error` event, `blocked: false`                                                                                                                                                                                                 |
| HTTP error, non-2xx or timeout               | `blocked: false`, by design to match Claude Code                                                                                                                                                                                |
| Exit code other than 0 or 2                  | not blocked                                                                                                                                                                                                                     |
| `prompt` or `agent` handler                  | logged at debug level and skipped, so a policy written as a prompt hook silently never runs                                                                                                                                     |
| Exception inside `runHooks`                  | `HookService.fireEvent` catches it and returns not blocked                                                                                                                                                                      |
| Settings file that exists but does not parse | warning in the log, then the file is skipped as if absent                                                                                                                                                                       |

Scope: failure blocks only for events that can stop something, which are `PreToolUse`, `PermissionRequest` and `UserPromptSubmit`. `PostToolUse` and the lifecycle events cannot undo what already happened, so a failure there is logged and shown.

A blocked call returns the reason to the model as the tool result (status `canceled`, the same path as a permission denial), with the cause in it: "hook X timed out after 600 s".

Differences from Claude Code to document: exit codes other than 0 and 2 block by default here, and a hook file written for Claude Code that exits 1 on a warning will start blocking until it gets `onError: "allow"`.

An unparseable settings file is the hard case. We cannot know which events it defined, so blocking everything is too blunt. Plan: refuse to start in headless mode and show a clear error in the TUI, because silently dropping a policy file is the worse outcome.

Smaller fixes in the same change:

- The default command timeout is 600 s. For `PreToolUse` that is ten minutes of a frozen agent. Lower it to 30 s for events that can block.
- On Windows the command runs under `cmd.exe /c`, and the timeout kills `cmd`, not its children. Kill the process tree.
- `prompt` and `agent` handlers: until they exist, treat them as an error (fail closed) with the message "handler type not supported", not a silent skip.

## Call sites

Phase 1 covers the four events that can stop or change an action.

| Event                | Where                                                                                                            | A blocking result                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `PreToolUse`         | `executeStreamedToolCalls`, permission phase, after `onToolStart` and before `checkToolPermissionApproval`       | tool result `canceled` with the hook's reason              |
| `PostToolUse`        | same function, inside the execution promise, after `executeToolCall` returns                                     | cannot undo; `additionalContext` is appended to the result |
| `PostToolUseFailure` | same place, in the `catch`                                                                                       | none                                                       |
| `UserPromptSubmit`   | before `addUserMessage` in `commands/chat.ts` and `commands/serve.ts`, and for the first prompt in headless mode | the message is not added and the reason is shown           |

Phase 2: `Stop` (needs a guard so a hook that keeps blocking cannot loop forever; the input already carries `stop_hook_active`), `SessionStart`, `SessionEnd`, `PreCompact`, `Notification`, `PermissionRequest`.

### Order against permissions

1. `PreToolUse` hooks run first, so the permission check sees the final arguments.
2. A hook `deny` blocks the call whatever the permission policy says.
3. A hook `allow` skips the user prompt but never overrides a policy `exclude`. A hook must not be able to widen what policy forbids.
4. A hook `ask` forces the prompt even for a tool the policy allows. In headless mode `ask` counts as a policy denial, as it does now.
5. `updatedInput` replaces the arguments. `tool.preprocess` already ran on the originals, and `executeToolCall` prefers `preprocessResult.args`, so the wiring must re-run `preprocess` on the new arguments, or the edit is silently ignored.

### Aggregation fix

`aggregateResults` assigns `permissionDecision` once per hook, so the last hook wins. With one hook returning `deny` and a later one `allow`, `blocked` is true but `permissionDecision` reads `allow`. Change it to a fixed precedence of deny, then ask, then allow. When several hooks return `updatedInput`, the last in config order wins and a warning names both.

## Project hooks need a trust check

Every project file (`.continue/settings.json`, `.claude/settings.json` and the two `settings.local.json`) is loaded and its commands run through a shell. Once hooks are wired, cloning a repository and running `cn` would run whatever that repository ships. A search of the CLI source for a trust or approval step found none, though the search patterns were narrow and should be repeated when the work starts.

Plan:

- User-level files (`~/.continue`, `~/.claude`) always load.
- Project-level files load only after the user trusts that project. Trust is stored in `~/.continue/trusted-hooks.json` as the project's real path plus a hash of its hook definitions. Changing the hooks asks again, as `direnv allow` does.
- The TUI asks once, showing every command that would run.
- Headless mode has no one to ask. Untrusted project hooks are skipped with a warning, unless `--trust-project-hooks` is passed. There is no environment variable for this: the CLI loads a `.env` from the working directory, so a repository could set it. This is not a fail-open hole: a project file is not organisation policy, which belongs in a user-level or managed file.

## Decisions needed

- Whether `~/.claude/settings.json` should load at all. It does today. After wiring, a user who has Claude Code hooks would find them running in `cn` without having asked. Options: load it, load it with a one-line notice at startup, or require opting in. Leaning towards the notice.
- Whether to add a managed settings path that only an administrator can write, for organisation policy. Out of scope here, but it decides whether `onError` defaults can be enforced.

## Tests

The 35 existing tests have no case for timeout, trust, or exit codes other than 0 and 2. New cases:

- Timeout blocks a `PreToolUse` and is only logged for `PostToolUse`. A slow command is killed within the limit, including child processes on Windows.
- Command not found, exit 1, non-2xx HTTP and `prompt` handler each block a `PreToolUse` and carry the cause in the reason. Each is allowed through with `onError: "allow"`.
- Unparseable settings file stops headless start-up and shows an error in the TUI.
- Precedence: `deny` then `allow` ends denied, and the reverse does too.
- `allow` cannot override an `exclude` policy. `ask` forces a prompt on an allowed tool.
- `updatedInput` reaches the tool, through `preprocess`, and the permission check sees it.
- Untrusted project hooks do not run. Editing a trusted project's hooks revokes trust. User-level hooks run without trust.
- `UserPromptSubmit` block leaves the history unchanged.

An integration test in `extensions/cli` should run a real command hook that blocks `runTerminalCommand` and check the model receives the reason.

## Docs

There is no hooks page. Add `docs/cli/hooks.mdx` in the docs style: the command first, the settings file shape, the exit-code table, the `onError` key, and the trust step. A reference page for the event schema, not a tutorial.

## Not in this plan

- Hooks in the IDE. The tool path is in `core` and has no hook code, so it needs the runner moved or shared first.
- Real `prompt` and `agent` handlers. The subagent executor could back `agent`; separate change.
- `SubagentStart`, `SubagentStop`, `WorktreeCreate`, `WorktreeRemove`, `ConfigChange`, `TeammateIdle`, `TaskCompleted`.
