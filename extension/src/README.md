# Continue VS Code Extension README

## How to debug the VS Code Extension

1. Clone the Continue repo

2. Open a VS Code window with the `continue` directory as your workspace

3. Package and then start the FastAPI server by following instructions outlined in the `Continue Server` section of the `continuedev/README.md`

4. Open a VS Code window with the `extension` directory as your workspace

5. From `continue/extension`, run `npm install`

6. Run `npm run full-package`

7. Open `src/activation/activate.ts` file (or any TypeScript file)

8. Press `F5` on your keyboard to start `Run and Debug` mode

9. `cmd+shift+p` to look at developer console and select Continue commands

10. Every time you make changes to the code, you need to run `npm run compile`

11. If you run into a "command not found" error, try running `npm run rebuild` and then `npm run compile`

## Alternative: Install from source

Update: directions to root README

## Background

- `src/bridge.ts`: connects this VS Code Extension to our Python backend that interacts with GPT-3
- `src/debugPanel.ts`: contains the HTML for the full window on the right (used for investigation)
- `src/DebugViewProvider.ts`: contains the HTML for the bottom left panel
- `src/extension.ts`: entry point into the extension, where all of the commands / views are registered (activate function is what happens when you start extension)
- `media/main.js`: handles messages sent from the extension to the webview (bottom left)
- `media/debugPanel.js`: loaded by right window

## Features

- `List 10 things that might be wrong` button
- `Write a unit test to reproduce bug` button
- Highlight a code range + `Find Suspicious Code` button
- `Suggest Fix` button
- A fix suggestion shown to you + `Make Edit` button
- Write a docstring for the current function
- Ask a question about your codebase
- Move up / down to the closest suggestion

## Commands

- "Write a docstring for the current function" command (windows: `ctrl+alt+l`, mac: `shift+cmd+l`)
- "Open Continue GUI" command
- "Ask a question from input box" command (windows: `ctrl+alt+j`, mac: `shift+cmd+j`)
- "Open Captured Terminal" command
- "Ask a question from webview" command (what context is it given?)
- "Create Terminal" command ???
- "Suggestion Down" command (windows: `shift+ctrl+down`, mac: `shift+ctrl+down`)
- "Suggestion Up" command (windows: `shift+ctrl+up`, mac: `shift+ctrl+up`)
- "Accept Suggestion" command (windows: `shift+ctrl+enter`, mac: `shift+ctrl+enter`)
