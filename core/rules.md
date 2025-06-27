# `core` rules

Whenever a new protocol message is added to the `protocol/` directory, check the following:

- It's type is defined correctly
- If it is a message from webview to core or vice versa:
  - It has been added to `core/protocol/passThrough.ts`
  - It has been added to `extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/constants/MessageTypes.kt`
- It is implemented in either `core/core.ts` (for messages to the core), in a `useWebviewListener` (for messages to the gui), or in `VsCodeMessenger.ts` for VS Code or `IdeProtocolClient.kt` for JetBriains (for messages to the IDE).
- It does not duplicate functionality from another message type that already exists.
