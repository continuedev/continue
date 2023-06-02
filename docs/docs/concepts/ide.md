# IDE

## Supported IDEs

### VS Code

The VS Code extension implementation can be found at `/continue/extension/src`

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
