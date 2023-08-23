# Continue VS Code Extension

This is the Continue VS Code Extension. Its primary jobs are

1. Implement the IDE side of the Continue IDE protocol, allowing a Continue server to interact natively in an IDE. This happens in `src/continueIdeClient.ts`.
2. Open the Continue React app in a side panel. The React app's source code lives in the `react-app` directory. The panel is opened by the `continue.openContinueGUI` command, as defined in `src/commands.ts`.
3. Run a Continue server in the background, which connects to both the IDE protocol and the React app. The server is launched in `src/activation/environmentSetup.ts` by calling Python code that lives in `server/` (unless extension settings define a server URL other than localhost:65432, in which case the extension will just connect to that).

# How to run the extension

See [Environment Setup](../CONTRIBUTING.md#environment-setup)

# How to run and debug tests

After following the setup in [Environment Setup](../CONTRIBUTING.md#environment-setup) you can run `npm run test` in the command line or the `Server + Tests (VSCode)` launch configuration in VS Code to debug tests + server.

## Notes

- We require vscode engine `^1.67.0` and use `@types/vscode` version `1.67.0` because this is the earliest version that doesn't break any of the APIs we are using. If you go back to `1.66.0`, then it will break `vscode.window.tabGroups`.
