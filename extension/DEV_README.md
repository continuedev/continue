# Continue VS Code Extension

This is the Continue VS Code Extension. Its primary jobs are

1. Implement the IDE side of the Continue IDE protocol, allowing a Continue server to interact natively in an IDE. This happens in `src/continueIdeClient.ts`.
2. Open the Continue React app in a side panel. The React app's source code lives in the `react-app` directory. The panel is opened by the `continue.openContinueGUI` command, as defined in `src/commands.ts`.
3. Run a Continue server in the background, which connects to both the IDE protocol and the React app. The server is launched in `src/activation/environmentSetup.ts` by calling Python code that lives in `server/` (unless extension settings define a server URL other than localhost:65432, in which case the extension will just connect to that).

## How to debug the VS Code Extension

1. Clone the Continue repo

2. Open a VS Code window with the `continue` directory as your workspace

3. Package and then start the FastAPI server by following instructions outlined in the `Continue Server` section of the `continuedev/README.md`

4. Open a VS Code window with the `extension` directory as your workspace

5. Run `npm run package`

6. Open `src/activation/activate.ts` file (or any TypeScript file)

7. Press `F5` on your keyboard to start `Run and Debug` mode

8. `cmd+shift+p` to look at developer console and select Continue commands

9. Every time you make changes to the code, you need to run `npm run esbuild` unless you make changes inside of `react-app` and then you need to run `npm run build` from there

## Notes

- We require vscode engine `^1.67.0` and use `@types/vscode` version `1.67.0` because this is the earliest version that doesn't break any of the APIs we are using. If you go back to `1.66.0`, then it will break `vscode.window.tabGroups`.
