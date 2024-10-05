# PearAI VS Code Extension

This is the PearAI VS Code Extension. Its primary jobs are

1. Implement the IDE side of the PearAI IDE protocol, allowing a PearAI server to interact natively in an IDE. This happens in `src/continueIdeClient.ts`.
2. Open the PearAI React app in a side panel. The React app's source code lives in the `gui` directory. The panel is opened by the `continue.openContinueGUI` command, as defined in `src/commands.ts`.

# How to run the extension

See [Environment Setup](../CONTRIBUTING.md#environment-setup)

# How to run and debug tests

After following the setup in [Environment Setup](../CONTRIBUTING.md#environment-setup) you can run the `Extension (VSCode)` launch configuration in VS Code.

## Notes

- We require vscode engine `^1.67.0` and use `@types/vscode` version `1.67.0` because this is the earliest version that doesn't break any of the APIs we are using. If you go back to `1.66.0`, then it will break `vscode.window.tabGroups`.
