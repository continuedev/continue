# Marcel-to-Yuto Implementation Roadmap

Last updated: 2026-05-09

## Goal

Close the highest-value parity gaps between `marcel/` and the Yuto codebase without doing a wholesale port.

The strategy is:

- keep `core/` as the shared home for behavior that should apply across products
- keep `extensions/cli/` and `extensions/vscode/` thin where possible
- finish and harden Marcel-inspired systems that already exist in Yuto before adding new surface area

## Planning Principles

- Prefer adapting existing Yuto services over copying Marcel modules one-for-one.
- Move shared logic into `core/` first when both CLI and editor will need it.
- Reuse existing frontmatter and hook utilities instead of creating parallel implementations.
- Gate every new subsystem behind feature flags during rollout.

## Existing Yuto Building Blocks To Extend

These are already present and should be extended rather than replaced:

- `extensions/cli/src/services/MemoryService.ts`
- `extensions/cli/src/services/SystemMessageService.ts`
- `extensions/cli/src/services/SessionMemoryService.ts`
- `extensions/cli/src/services/AutoDreamService.ts`
- `extensions/cli/src/hooks/HookService.ts`
- `extensions/cli/src/services/TaskStateService.ts`
- `extensions/cli/src/services/BackgroundJobService.ts`
- `extensions/cli/src/services/ProgressTrackerService.ts`
- `extensions/cli/src/subagent/executor.ts`
- `extensions/cli/src/tools/subagent.ts`
- `core/agent/SessionMemory.ts`
- `core/agent/autoDream.ts`
- `core/agent/AgentRunner.ts`
- `core/tools/implementations/subagent.ts`
- `core/util/conversationCompaction.ts`
- `packages/config-yaml/src/markdown/markdownToRule.ts`

## Progress Snapshot

- Completed: WS0, WS1, WS2, WS3, WS4, WS5, WS6, WS7, WS8, and WS9.
- Remaining: no tracked Marcel-parity workstreams.

## Workstream Status

| Workstream | Status    | Current State                                                                                                                                                                                                                                       | Remaining Effort |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| WS0        | Completed | Shared flags and task and turn contracts landed.                                                                                                                                                                                                    | none             |
| WS1        | Completed | Semantic memory selection and memdir helpers landed in `core/agent/memdir`.                                                                                                                                                                         | none             |
| WS2        | Completed | CLI turn lifecycle hooks now own post-tool and turn-end orchestration.                                                                                                                                                                              | none             |
| WS3        | Completed | Session memory and AutoDream now share lifecycle helpers across core and CLI.                                                                                                                                                                       | none             |
| WS4        | Completed | Structured task notifications and shell stall detection are in place.                                                                                                                                                                               | none             |
| WS5        | Completed | Coordinator scratchpad, worker guidance, CLI controls, and cancel-resume semantics landed.                                                                                                                                                          | none             |
| WS6        | Completed | CLI statusline and vim mode landed behind feature flags.                                                                                                                                                                                            | none             |
| WS7        | Completed | Typed bridge contracts, reusable callbacks, dialog launchers, cancel-safe webview requests, GUI-rendered bridge permission dialogs with extension fallback, focused open-agent-local coverage, and the GUI handoff into the live agent view landed. | none             |
| WS8        | Completed | Cached microcompaction landed in the CLI compaction path.                                                                                                                                                                                           | none             |
| WS9        | Completed | Docs are synced, rollout guidance is documented, and the main CLI/core test gaps are covered.                                                                                                                                                       | none             |

Original kickoff estimate: about 40-57 engineer-days.

Remaining estimate: none.

Remaining wall-clock:

- none

## WS0: Shared Flags And Contracts

### Outcome

Establish stable contracts and rollout switches before touching memory, tasks, or editor integration.

### Concrete Files

Modify:

- `extensions/cli/src/services/FeatureFlagsService.ts`
- `extensions/cli/src/services/index.ts`
- `extensions/cli/src/hooks/types.ts`
- `core/tools/implementations/subagent.ts`
- `extensions/cli/src/tools/subagent.ts`

Create:

- `core/agent/contracts/TaskNotification.ts`
- `core/agent/contracts/TurnLifecycle.ts`

### New Flags

- `SEMANTIC_MEMORY_SELECTION`
- `TURN_LIFECYCLE_HOOKS`
- `TASK_NOTIFICATIONS`
- `CLI_STATUSLINE`
- `CLI_VIM_MODE`
- `VSCODE_BRIDGE_PERMISSIONS`
- `CACHED_MICROCOMPACTION`

### Dependencies

- none

### Notes

- `TaskNotification` should become the shared contract for status, summary, usage, and task identity.
- `TurnLifecycle` should define turn-start, after-response, after-tools, and turn-end hooks.

### Exit Criteria

- New contracts compile in `core/`.
- CLI feature flags can gate all later workstreams.
- Subagent output metadata shape is stable enough for future coordinator and UI work.

## WS1: Semantic Memory Selection And Memdir V2

### Outcome

Upgrade Yuto from simple keyword-ranked memory injection to Marcel-style multi-file memory discovery with metadata and semantic selection.

### Concrete Files

Modify:

- `extensions/cli/src/services/MemoryService.ts`
- `extensions/cli/src/services/SystemMessageService.ts`
- `extensions/cli/src/services/AutoDreamService.ts`
- `extensions/cli/src/services/SessionMemoryService.ts`
- `extensions/cli/src/services/index.ts`

Create:

- `core/agent/memdir/memoryScan.ts`
- `core/agent/memdir/findRelevantMemories.ts`
- `core/agent/memdir/types.ts`
- `core/agent/memdir/formatMemoryManifest.ts`
- `core/agent/memdir/findRelevantMemories.test.ts`

Reuse:

- `packages/config-yaml/src/markdown/markdownToRule.ts` for YAML frontmatter parsing

### Dependencies

- WS0 feature flags and shared contracts

### Implementation Notes

- Support multiple markdown memory files instead of treating `MEMORY.md` as the only durable unit.
- Parse frontmatter fields like `description`, `type`, and optional `name`.
- Track `mtime` and skip already-surfaced files.
- Preserve a fallback keyword ranking path when semantic selection is disabled or unavailable.
- Keep injected memory count capped, ideally matching Marcel's `up to 5` behavior.

### Tests

- extend or add `extensions/cli/src/services/MemoryService.test.ts`
- add tests for manifest generation, frontmatter parsing, freshness ordering, and already-surfaced filtering

### Effort

- 4-6 engineer-days

### Exit Criteria

- CLI memory injection uses shared `core/agent/memdir/*` helpers.
- Frontmatter-aware memory files are supported.
- Semantic selection is feature-flagged and falls back cleanly.

## WS2: Turn-End Lifecycle And Stop-Hook Unification

### Outcome

Introduce a single place to register post-response and post-tool side effects, similar to Marcel's `stopHooks`, while building on Yuto's existing hook infrastructure.

### Concrete Files

Modify:

- `core/agent/AgentRunner.ts`
- `extensions/cli/src/stream/streamChatResponse.ts`
- `extensions/cli/src/hooks/HookService.ts`
- `extensions/cli/src/hooks/fireHook.ts`
- `extensions/cli/src/hooks/types.ts`
- `extensions/cli/src/services/index.ts`

Create:

- `core/agent/TurnLifecycleRunner.ts`
- `core/agent/TurnLifecycleRunner.test.ts`
- `extensions/cli/src/hooks/internal/turnLifecycleAdapters.ts`

### Dependencies

- WS0

### Implementation Notes

- Do not create a second CLI hook system. Extend `extensions/cli/src/hooks/HookService.ts`.
- Separate user-configured external hooks from internal lifecycle handlers.
- Lifecycle slots should support:
  - after assistant response
  - after tool execution
  - turn end
  - session end
- Later workstreams should plug into this runner instead of calling services ad hoc.

### Effort

- 4-6 engineer-days

### Exit Criteria

- `AgentRunner` and CLI stream flow call a shared lifecycle runner.
- Session memory, autodream, task notifications, and future compaction hooks have a standard registration point.

## WS3: Session Memory And AutoDream Finish Pass

### Outcome

Finish the Marcel-derived memory lifecycle that already exists in both `core/` and CLI so it behaves consistently and exposes the right signals.

### Concrete Files

Modify:

- `core/agent/SessionMemory.ts`
- `core/agent/autoDream.ts`
- `core/agent/AgentRunner.ts`
- `extensions/cli/src/services/SessionMemoryService.ts`
- `extensions/cli/src/services/AutoDreamService.ts`
- `extensions/cli/src/stream/streamChatResponse.ts`

### Dependencies

- WS1
- WS2

### Implementation Notes

- Align gating across core and CLI: minimum token growth, minimum tool-call count, session-count gate, lock behavior, and stale-holder cleanup.
- Route extraction and consolidation through the shared turn lifecycle instead of calling them directly from multiple places.
- Persist enough metadata so later context-selection and scratchpad systems can reason about freshness and source session IDs.

### Effort

- 3-4 engineer-days

### Exit Criteria

- Core and CLI use the same lifecycle semantics.
- Session memory extraction and autodream are observable, feature-flagged, and non-duplicative.

## WS4: Task Runtime, Shell Watchdogs, And Structured Notifications

### Outcome

Bring Yuto's task and shell UX closer to Marcel's: richer task types, stalled-command detection, and a shared notification shape.

### Concrete Files

Modify:

- `extensions/cli/src/services/TaskStateService.ts`
- `extensions/cli/src/services/BackgroundJobService.ts`
- `extensions/cli/src/tools/runTerminalCommand.ts`
- `extensions/cli/src/tools/checkBackgroundJob.ts`
- `extensions/cli/src/ui/JobsSelector.tsx`
- `extensions/cli/src/services/ProgressTrackerService.ts`

Create:

- `core/agent/task/TaskRuntime.ts`
- `core/agent/task/TaskTypes.ts`
- `extensions/cli/src/services/TaskNotificationService.ts`
- `extensions/cli/src/services/TaskNotificationService.test.ts`

### Dependencies

- WS0
- WS2

### Implementation Notes

- Port Marcel's stall-watchdog pattern for shell output growth and prompt detection.
- Unify foreground and background task tracking under one runtime model.
- Keep `BackgroundJobService` as the process owner, but have `TaskStateService` become the source of truth for status and summaries.
- Emit structured task notifications that coordinator flows and future editor surfaces can consume.

### Effort

- 5-7 engineer-days

### Exit Criteria

- Stalled interactive shell prompts are detected.
- `/jobs` and `/status` read from the same task state.
- Task completion and failure summaries use the shared notification contract.

## WS5: Coordinator, Worker Scratchpad, And Subagent Hardening

### Status

Completed.

### Outcome

Move Yuto's coordinator mode from policy-only support to a stronger orchestration model with better worker context sharing.

### Landed

- `core/agent/coordinator/WorkerScratchpad.ts` and `core/agent/coordinator/CoordinatorContext.ts` now define the shared scratchpad path and worker system-message wrapper.
- `extensions/cli/src/subagent/executor.ts` now creates, reads, and appends a shared `WORKER_SCRATCHPAD.md` for coordinator-managed workers.
- `extensions/cli/src/tools/subagent.ts` and `extensions/cli/src/subagent/index.ts` now expose `coordinator-worker` as an explicit CLI profile.
- `core/tools/implementations/subagent.ts` and `core/tools/definitions/subagent.ts` now thread the same coordinator scratchpad and worker profile through the built-in core subagent path.
- `extensions/cli/src/systemMessage.ts` and `extensions/cli/src/util/loadMarkdownSkills.ts` now surface coordinator delegation guidance and worker-capable skill metadata.
- `extensions/cli/src/slashCommands.ts`, `extensions/cli/src/permissions/defaultPolicies.ts`, and `extensions/cli/src/permissions/permissionChecker.ts` now expose coordinator mode as a clearer user workflow with explicit shell guardrails.
- Coordinator-managed workers now record `cancelled` status explicitly and carry forward continuation guidance through the shared scratchpad.
- Focused coverage landed in `core/agent/coordinator/CoordinatorContext.vitest.ts`, `core/tools/implementations/subagent.vitest.ts`, `extensions/cli/src/systemMessage.coordinator.test.ts`, `extensions/cli/src/subagent/executor.test.ts`, and related CLI permission tests.

### Concrete Files

Modify:

- `extensions/cli/src/subagent/executor.ts`
- `extensions/cli/src/tools/subagent.ts`
- `core/tools/implementations/subagent.ts`
- `core/tools/definitions/subagent.ts`
- `extensions/cli/src/permissions/defaultPolicies.ts`
- `extensions/cli/src/permissions/permissionChecker.ts`
- `extensions/cli/src/slashCommands.ts`
- `extensions/cli/src/systemMessage.ts`
- `extensions/cli/src/util/loadMarkdownSkills.ts`

Create:

- none

Already created:

- `core/agent/coordinator/WorkerScratchpad.ts`
- `core/agent/coordinator/CoordinatorContext.ts`

### Dependencies

- WS2
- WS4

### Implementation Notes

- Introduce a coordinator-managed scratchpad or shared memdir for cross-worker state.
- Make subagent execution modes explicit: `explore`, `verify`, `coordinator-worker`, and default worker.
- Expose worker skills and restrictions through system message construction rather than only through mode policies.
- Keep mutation restrictions in coordinator mode, but make stop and continue semantics first-class.

### Remaining Implementation

- none.

### Effort

- none

### Exit Criteria

- Coordinator mode can spawn workers with stable profiles and shared scratch context.
- Worker summaries are structured and resumable.
- Skills can be described or delegated coherently to workers.

## WS6: CLI TUI Parity For Statusline And Vim Mode

### Outcome

Add the highest-value TUI parity features Marcel has over Yuto: a live status footer and a real vim editing mode.

### Concrete Files

Modify:

- `extensions/cli/src/ui/UserInput.tsx`
- `extensions/cli/src/ui/components/ChatScreenContent.tsx`
- `extensions/cli/src/services/ProgressTrackerService.ts`
- `extensions/cli/src/services/TaskStateService.ts`
- `extensions/cli/src/slashCommands.ts`

Create:

- `extensions/cli/src/ui/StatusLine.tsx`
- `extensions/cli/src/ui/VimTextInput.tsx`
- `extensions/cli/src/ui/hooks/useVimInput.ts`
- `extensions/cli/src/ui/UserInput.vim.test.tsx`

### Dependencies

- WS4

### Implementation Notes

- Start statusline with current model, mode, tokens, active tasks, and session duration.
- Do not block on shell PS1 integration. Keep the first version inside the TUI footer.
- Gate vim mode behind a feature flag and ship insert plus normal mode first.
- Preserve existing slash-command, file-search, and shell-mode behavior in `UserInput`.

### Effort

- 5-7 engineer-days

### Exit Criteria

- Status footer is visible and stable.
- Vim mode can be enabled without breaking current input behavior.

## WS7: VS Code Bridge Parity Foundation

### Status

Completed.

### Outcome

Port the editor-side patterns Marcel uses for permission requests and one-off UI flows so future remote or bridge work has the right base.

### Landed

- `core/agent/contracts/VSCodeBridge.ts` now defines shared permission, dialog, and state snapshot contracts.
- `extensions/cli/src/commands/serve.ts`, `extensions/cli/src/commands/serve.helpers.ts`, and `extensions/cli/src/session.ts` now use typed bridge payloads.
- `core/protocol/ideWebview.ts`, `extensions/vscode/src/extension/VsCodeMessenger.ts`, and `extensions/vscode/src/extension/showVSCodeBridgeDialog.ts` now support a typed `vscode/showDialog` request.
- `extensions/vscode/src/bridge/PermissionCallbacks.ts` now provides a reusable request, response, and cancellation registry for bridge permission callbacks.
- `extensions/vscode/src/ui/dialogLaunchers.ts` now provides a reusable launcher surface for bridge dialogs.
- `extensions/vscode/src/webviewProtocol.ts` and `extensions/vscode/src/ContinueGUIWebviewViewProvider.ts` now cancel pending bridge requests when the GUI webview is disposed.
- `extensions/vscode/src/extension/VsCodeMessenger.ts` now routes supported bridge dialogs through the GUI webview first, with timeout-backed fallback to the extension dialog launcher.
- `gui/src/hooks/ParallelListeners.tsx` and `gui/src/components/dialogs/VSCodeBridgeDialog.tsx` now render supported bridge dialogs in-webview and return typed responses to the extension.
- Focused coverage now exists for the launcher, timeout cleanup, and GUI dialog response path.

### Concrete Files

Modify:

- `extensions/vscode/src/webviewProtocol.ts`
- `extensions/vscode/src/extension/VsCodeMessenger.ts`
- `gui/src/hooks/ParallelListeners.tsx`
- `core/protocol/ideWebview.ts`

Create:

- `extensions/vscode/src/bridge/PermissionCallbacks.ts`
- `extensions/vscode/src/ui/dialogLaunchers.ts`
- `extensions/vscode/src/bridge/PermissionCallbacks.vitest.ts`
- `extensions/vscode/src/ui/dialogLaunchers.vitest.ts`
- `extensions/vscode/src/webviewProtocol.vitest.ts`
- `gui/src/components/dialogs/VSCodeBridgeDialog.tsx`
- `gui/src/components/Layout.bridgeDialog.test.tsx`

Already created:

- `core/agent/contracts/VSCodeBridge.ts`
- `extensions/vscode/src/extension/showVSCodeBridgeDialog.ts`

### Dependencies

- WS0

### Implementation Notes

- Add typed request IDs and typed responses for permission flows.
- Extract dialog invocation patterns into launcher helpers instead of wiring every flow inline.
- Prefer a webview-owned dialog when the GUI is available, but keep the extension launcher as the fallback path for unsupported dialog kinds or unavailable responders.

### Remaining Implementation

- none

### Effort

- none

### Exit Criteria

- Webview permission flows support request, response, and cancellation semantics.
- Dialog launching is reusable instead of ad hoc.

## WS8: Microcompaction And Context Budgeting

### Outcome

Move from simple compaction toward Marcel-style cached microcompaction and clearer context-window pressure handling.

### Concrete Files

Modify:

- `core/util/conversationCompaction.ts`
- `core/agent/AgentRunner.ts`
- `extensions/cli/src/compaction.ts`
- `extensions/cli/src/stream/streamChatResponse.ts`
- `extensions/cli/src/services/ContextAnalysisService.ts`

Create:

- `core/agent/compaction/microCompact.ts`
- `core/agent/compaction/cachedMicrocompact.ts`
- `core/agent/compaction/microCompact.test.ts`

### Dependencies

- WS1
- WS2
- WS4

### Implementation Notes

- Cache compaction decisions by turn and tool result identity.
- Keep the existing circuit breaker in `core/util/conversationCompaction.ts`.
- Surface context pressure in the CLI statusline and task summaries.
- Land this after the lifecycle runner so compaction can slot into a clean boundary.

### Effort

- 5-7 engineer-days

### Exit Criteria

- Compaction can prune incrementally without blindly recomputing the same summaries.
- Context-pressure information is visible to both the system message layer and the user.

## WS9: Docs, Tests, And Rollout Cleanup

### Status

Not started.

### Outcome

Finish the ports with docs, tests, and rollout guidance.

### Concrete Files

Modify:

- `extensions/cli/README.md`
- `extensions/vscode/README.md`
- `docs/guides/cli.mdx`
- `docs/guides/plan-mode-guide.mdx`
- `docs/guides/run-agents-locally.mdx`

Test Files To Add Or Extend:

- `extensions/cli/src/services/MemoryService.test.ts`
- `extensions/cli/src/services/TaskStateService.test.ts`
- `extensions/cli/src/services/ToolPermissionService.integration.test.ts`
- `extensions/cli/src/ui/UserInput.keyboard.test.ts`
- `core/agent/AgentRunner` tests
- `extensions/vscode` protocol tests around permission callbacks

### Dependencies

- all earlier streams

### Remaining Implementation

- Update CLI and VS Code docs to describe coordinator mode, semantic memory behavior, bridge dialogs, and cached microcompaction.
- Expand tests from the currently focused slices into repo-level service, integration, and protocol coverage.
- Document which parity features remain behind flags, which can graduate to default-on, and what the fallback paths are.
- Add a short regression recipe that covers the coordinator and bridge surfaces together.

### Effort

- 2-3 engineer-days, spread across the project

### Exit Criteria

- Each flagged feature has test coverage.
- User-facing docs mention coordinator mode, memory behavior, and new CLI affordances.
- Rollout defaults and fallback paths are documented.

## Remaining Delivery Order

None. The tracked roadmap workstreams are complete.

## Remaining Parallelization Plan

None.

## Next PRs To Open

None required for the Marcel-parity roadmap.

## Explicit Deferrals

These should inform design but should not be ported one-for-one in the first pass:

- Marcel terminal-specific bridge rendering in `marcel/src/bridge/bridgeUI.ts`
- QR flows and terminal install wizards that are specific to Marcel's runtime model
- Full remote session transport parity beyond the landed webview-first permission flow
- Any direct copy of Marcel's entire task graph implementation without first stabilizing Yuto's existing task and background-job services

## Definition Of Done For The Roadmap

This roadmap is complete when:

- shared behavior lives in `core/` where both CLI and editor can consume it
- CLI services stop duplicating orchestration logic in the stream loop
- memory, coordinator, and task systems share contracts instead of passing raw strings
- editor integration uses typed permission and dialog flows
- the final feature set is testable and behind reversible rollout flags
