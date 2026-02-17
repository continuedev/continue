---
name: Protocol Layer Consistency
description: Ensure protocol message changes are synchronized across all platform layers.
---

## Context

Continue is a multi-platform application (VS Code, JetBrains, web GUI) that communicates through a typed protocol layer. When protocol messages are added or changed in one layer, the other layers must be updated to match. Missing updates cause silent failures or runtime crashes that are hard to debug. This check enforces the process in `.continue/rules/new-protocol-message.md`.

## What to Check

If the PR modifies any of the following protocol-related files, verify that all required layers are updated:

### Protocol type definitions

- `core/protocol/` - Core type definitions for messages between IDE, core, and GUI

### Message passthrough

- `core/protocol/passThrough.ts` - Routes messages between webview and core. New webview-to-core messages must be registered here.

### IDE-specific handlers

- `extensions/vscode/src/VsCodeMessenger.ts` - VS Code message handler
- `extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/constants/MessageTypes.kt` - JetBrains message type registry

### Core handler

- `core/core.ts` - Core-side message handler

### GUI handler

- `gui/` files using `useWebviewListener` - GUI-side message listeners

## Specific Checks

1. **New message type added to protocol**: Verify the handler exists in the appropriate location (core.ts for messages to core, useWebviewListener for messages to GUI, VsCodeMessenger.ts for messages to VS Code IDE).

2. **Webview-to-core message added**: Verify it's registered in `passThrough.ts` AND in `MessageTypes.kt` for JetBrains support.

3. **Message type signature changed**: Verify all consumers of that message type are updated to match the new signature.

4. **Message removed**: Verify it's removed from all layers, not just one.

## Pass/Fail Criteria

- **Pass** if the PR doesn't touch protocol-related files, or if all required layers are updated consistently.
- **Fail** if a protocol message is added, changed, or removed in one layer but the corresponding updates are missing in other layers. Specifically call out which files need updating.

## Exclusions

- Changes to message handler _implementation_ (business logic) that don't alter the message type or signature.
- Test-only changes to protocol mocks.
