---
name: New protocol message
description: Create a new protocol message from core/gui/ide to core/gui/ide
alwaysApply: false
---

Create a new protocol message by taking the following steps:

## 1. Define the message type

Add your new message type definition to the appropriate file in the `protocol/` directory with correct TypeScript typing.

## 2. Check for duplicates

Verify that no existing message type already provides the same functionality.

## 3. Add to passThrough (if webview ↔ core)

If your message is between webview and core, add it to `core/protocol/passThrough.ts`.

## 4. Add to IntelliJ constants (if webview ↔ core)

If your message is between webview and core, add it to `extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/constants/MessageTypes.kt`.

## 5. Implement the message handler

Implement the message in the appropriate location:

- **Messages to core**: `core/core.ts`
- **Messages to GUI**: `useWebviewListener` hook
- **Messages to VS Code IDE**: `VsCodeMessenger.ts`
- **Messages to JetBrains IDE**: `IdeProtocolClient.kt`

## 6. Test the implementation

Verify that your message works correctly in both VS Code and JetBrains IDEs if applicable.
