# Yuto Remaining Implementation Work

Updated: 2026-05-08

This file tracks only the Marcel-parity work that is still open after the current implementation pass.

## Already Landed

- Shared rollout flags and cross-surface contracts
- Semantic memory selection and memdir helpers
- Turn lifecycle hooks and post-tool and turn-end unification
- Session memory and AutoDream finish pass
- Structured task notifications and shell watchdogs
- CLI statusline and vim mode
- Cached microcompaction
- Typed CLI serve bridge contracts and a first VS Code dialog bridge helper

## WS5: Finish Coordinator Workflows

Current state:

- CLI subagent execution now creates and reuses a coordinator scratchpad.
- Coordinator workers can run with an explicit `coordinator-worker` profile in the CLI tool surface.
- Worker results and failures are appended to a shared `WORKER_SCRATCHPAD.md`.

Remaining implementation:

- Thread coordinator scratchpad support through the core built-in subagent path so non-CLI callers use the same shared context:
  - `core/tools/implementations/subagent.ts`
  - `core/tools/definitions/subagent.ts`
- Add core tests for coordinator context and scratchpad formatting:
  - `core/agent/coordinator/CoordinatorContext.test.ts`
- Push worker-specific restrictions and delegation guidance into system-message construction instead of relying mostly on permission mode:
  - `extensions/cli/src/systemMessage.ts`
  - `extensions/cli/src/util/loadMarkdownSkills.ts`
- Finish coordinator UX and control flow:
  - `extensions/cli/src/slashCommands.ts`
  - `extensions/cli/src/permissions/defaultPolicies.ts`
  - `extensions/cli/src/permissions/permissionChecker.ts`
- Make stop and continue semantics first-class for coordinator-managed subagents instead of leaving them implicit in the stream path.

Exit gap:

- Coordinator mode is no longer policy-only, but the shared worker context is still CLI-executor specific.
- Worker skills and delegation guidance are not yet surfaced coherently to every worker.
- Coordinator control semantics are not yet exposed as a clear user-facing workflow.

Estimated remaining effort:

- 2-4 engineer-days

## WS7: Finish VS Code Bridge Parity Foundation

Current state:

- Shared bridge contracts exist in `core/agent/contracts/VSCodeBridge.ts`.
- CLI `/permission` and `/state` payloads are typed.
- The VS Code extension can handle a typed `vscode/showDialog` request through `extensions/vscode/src/extension/showVSCodeBridgeDialog.ts`.

Remaining implementation:

- Add reusable permission callback registration with request, response, and cancellation semantics:
  - `extensions/vscode/src/bridge/PermissionCallbacks.ts`
  - `extensions/vscode/src/bridge/PermissionCallbacks.test.ts`
- Move one-off dialog launching behind a reusable launcher surface that future bridge flows can share:
  - `extensions/vscode/src/ui/dialogLaunchers.ts`
- Finish protocol plumbing for transport-agnostic permission flows:
  - `extensions/vscode/src/webviewProtocol.ts`
  - `extensions/vscode/src/ContinueGUIWebviewViewProvider.ts`
  - `extensions/vscode/src/ContinueConsoleWebviewViewProvider.ts`
  - `core/protocol/core.ts`
  - `core/protocol/passThrough.ts`
- Add cancellation-aware tests around permission callbacks and bridge responses.

Exit gap:

- Dialog requests exist, but reusable permission callbacks and cancel semantics are not finished.
- The current dialog bridge is extension-side; the broader transport-agnostic bridge path is not fully wired.

Estimated remaining effort:

- 2-4 engineer-days

## WS9: Docs, Tests, And Rollout Cleanup

Remaining docs:

- `extensions/cli/README.md`
- `extensions/vscode/README.md`
- `docs/guides/cli.mdx`
- `docs/guides/plan-mode-guide.mdx`
- `docs/guides/run-agents-locally.mdx`

Remaining test additions or extensions:

- `extensions/cli/src/services/MemoryService.test.ts`
- `extensions/cli/src/services/TaskStateService.test.ts`
- `extensions/cli/src/services/ToolPermissionService.integration.test.ts`
- `extensions/cli/src/ui/UserInput.keyboard.test.ts`
- `core/agent/AgentRunner` tests
- `extensions/vscode` protocol tests around permission callbacks

Remaining rollout decisions:

- Document which parity features remain behind flags and which can graduate to default-on.
- Document fallback behavior for semantic memory selection, coordinator mode, bridge dialogs, and cached microcompaction.
- Add a short regression recipe that covers the new coordinator and bridge surfaces together.

Exit gap:

- Core behavior is ahead of repo docs.
- Test coverage exists for the new local slices, but repo-level rollout and docs are not finished.

Estimated remaining effort:

- 2-3 engineer-days

## Suggested Execution Order

1. Finish WS5 core and tooling parity so coordinator workflows are shared beyond the CLI executor.
2. Finish WS7 permission callback and cancellation semantics.
3. Finish WS9 docs, tests, and rollout cleanup after the behavior is stable.

## Not Remaining

- Memory lifecycle stabilization
- CLI statusline
- CLI vim mode
- Cached microcompaction
- Structured task notifications
- First-pass bridge contracts and typed dialog helper
