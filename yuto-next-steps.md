# Yuto Remaining Implementation Work

Updated: 2026-05-09

This file tracks only the Marcel-parity work that is still open after the current implementation pass.

There is no remaining Marcel-parity implementation work currently tracked.

## Already Landed

- Shared rollout flags and cross-surface contracts
- Semantic memory selection and memdir helpers
- Turn lifecycle hooks and post-tool and turn-end unification
- Session memory and AutoDream finish pass
- Structured task notifications and shell watchdogs
- CLI statusline and vim mode
- Cached microcompaction
- Typed CLI serve bridge contracts and a first VS Code dialog bridge helper
- Shared coordinator scratchpad support in both CLI and core subagent paths
- Coordinator system-message guidance, worker-capable skill metadata, and coordinator CLI controls
- Explicit cancelled-worker scratchpad status and resume guidance for coordinator-managed workers
- VS Code bridge permission callback registry, shared dialog launcher surface, cancel-safe webview request cleanup, and a live remote permission response flow when opening agents locally
- CLI, plan-mode, local-agent, and VS Code extension docs synced to the current coordinator and remote-permission behavior
- Focused extension coverage for `openAgentLocally`, including sequential pending-permission draining before the refreshed session loads
- `loadAgentSession` now carries the background agent session ID into the GUI so opening an agent locally enters the live `AgentChatView` instead of only loading history

## WS7: Finish VS Code Bridge Parity Foundation

Completed.

Landed in the final WS7 pass:

- `extensions/vscode/src/extension/VsCodeMessenger.ts` now requests bridge warning and approval dialogs through the GUI webview first, with timeout-backed fallback to the extension launcher.
- `extensions/vscode/src/webviewProtocol.ts` now supports timeout-backed request cleanup so an unavailable webview responder does not hang `openAgentLocally`.
- `gui/src/hooks/ParallelListeners.tsx` and `gui/src/components/dialogs/VSCodeBridgeDialog.tsx` now render supported bridge dialogs inside the webview and return typed responses to the extension.
- Focused coverage now exists in `extensions/vscode/src/extension/VsCodeMessenger.vitest.ts`, `extensions/vscode/src/webviewProtocol.vitest.ts`, and `gui/src/components/Layout.bridgeDialog.test.tsx`.

## WS9: Docs, Tests, And Rollout Cleanup

Completed.

Landed in this cleanup pass:

- `docs/guides/coordinator-background-agent-rollout.mdx` now documents active vs definition-only rollout flags, fallback behavior, and a manual regression recipe for coordinator mode plus the background-agent handoff.
- Docs navigation and guide discovery were updated in `docs/docs.json` and `docs/guides/overview.mdx`.
- CLI and core coverage now exist for the coordinator, memory, task, keyboard, and open-agent-local slices that were previously tracked here.

## Suggested Execution Order

None. All Marcel-parity workstreams tracked in this file are complete.

## Not Remaining

- Memory lifecycle stabilization
- CLI statusline
- CLI vim mode
- Cached microcompaction
- Structured task notifications
- First-pass bridge contracts and typed dialog helper
- First live remote permission-response flow
- Coordinator workflow parity
