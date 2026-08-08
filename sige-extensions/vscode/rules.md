The `extensions/vscode` folder contains code for the "Continue" VS Code Extension. Continue is a coding extension which extends IDE functionality with AI.
Core IDE functionality, such as reading files, is implemented using the `VSCodeIDE` class. Code to enable editing/diff streaming into the editor, code suggestion autocompletion, and more can also be found in this directory.
Shared code that has abstract logic for the extension is in `core/`. Avoid importing code from `core/` directly where possible. Core is designed to be bundalable as a binary. Use `core.invoke` to send messages to the

- see `core/protocol/core.ts` for a list of commands VS Code can post/request to Core
- see `core/portocol/ide.ts` for a list of commands/message types core can post/request to VS Code
