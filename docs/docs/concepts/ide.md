# IDE

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
The **IDE** is the text editor where you manually edit your code.
:::

## Details

SDK provides "IDEProtocol" class so that steps can interact with VS Code, etc... in an IDE-agnostic way. Communicates with editor through websockets protocol. All that's needed to make continue work with a new IDE/editor is to implement the protocol on the side of the editor.

- `ide_protocol.py` is just the abstract version of what is implemented in `ide.py`, and `main.py` runs both `notebook.py` and `ide.py` as a single FastAPI server. This is the entry point to the Continue server, and acts as a bridge between IDE and React app
- extension directory contains 1. The VS Code extension, whose code is in `extension/src`, with `extension.ts` being the entry point, and 2. the Continue React app, in the `extension/react-app` folder. This is displayed in the sidebar of VS Code, but is designed to work with any IDE that implements the protocol as is done in `extension/src/continueIdeClient.ts`.

## Supported IDEs

### VS Code

You can install the VS Code extension [here](../install.md)

### GitHub Codespaces

You can install the GitHub Codespaces extension [here](../getting-started.md)

## IDE Protocol methods

### handle_json

Handle a json message

### showSuggestion

Show a suggestion to the user

### getWorkspaceDirectory

Get the workspace directory

### setFileOpen

Set whether a file is open

### openGUI

Open a gui

### showSuggestionsAndWait

Show suggestions to the user and wait for a response

### onAcceptRejectSuggestion

Called when the user accepts or rejects a suggestion

### onTraceback

Called when a traceback is received

### onFileSystemUpdate

Called when a file system update is received

### onCloseGUI

Called when a gui is closed

### onOpenGUIRequest

Called when a gui is requested to be opened

### getOpenFiles

Get a list of open files

### getHighlightedCode

Get a list of highlighted code

### readFile

Read a file

### readRangeInFile

Read a range in a file

### editFile

Edit a file

### applyFileSystemEdit

Apply a file edit

### saveFile

Save a file
