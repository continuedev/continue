# IDE

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
The **IDE** is the text editor where you manually edit your code.
:::

## Details

**TODO: Nate to brain dump anything important to know and Ty to shape into paragraphs**

- `ide_protocol.py` is just the abstract version of what is implemented in `ide.py`, and `main.py` runs both `notebook.py` and `ide.py` as a single FastAPI server. This is the entry point to the Continue server, and acts as a bridge between IDE and React app
- extension directory contains 1. The VS Code extension, whose code is in `extension/src`, with `extension.ts` being the entry point, and 2. the Continue React app, in the `extension/react-app` folder. This is displayed in the sidebar of VSCode, but is designed to work with any IDE that implements the protocol as is done in `extension/src/continueIdeClient.ts`.

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

### openNotebook

Open a notebook

### showSuggestionsAndWait

Show suggestions to the user and wait for a response

### onAcceptRejectSuggestion

Called when the user accepts or rejects a suggestion

### onTraceback

Called when a traceback is received

### onFileSystemUpdate

Called when a file system update is received

### onCloseNotebook

Called when a notebook is closed

### onOpenNotebookRequest

Called when a notebook is requested to be opened

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