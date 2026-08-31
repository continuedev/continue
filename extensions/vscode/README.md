<div align="center">

# Shadow Code

**AI code agent for VS Code**

</div>

Shadow Code brings an AI coding agent into your editor: chat about your codebase,
make multi-file edits, run an autonomous agent, and get inline autocomplete.

## Features

- **Chat** — ask questions about your code without leaving the editor (`Ctrl/Cmd + L`)
- **Edit** — describe a change in natural language and apply it inline (`Ctrl/Cmd + I`)
- **Agent** — let the model plan and carry out larger tasks with tool access
- **Autocomplete** — inline single- and multi-line suggestions as you type

## Getting started

1. Install the extension.
2. Open the Shadow Code sidebar from the activity bar.
3. Configure a model provider, then start chatting.

Configuration lives in `~/.shadow-code/config.yaml` (global) and in a
`.shadow-code/` folder in your workspace (rules, prompts, assistants).

## Keyboard shortcuts

| Action                       | macOS                     | Windows / Linux            |
| ---------------------------- | ------------------------- | -------------------------- |
| Add highlighted code to chat | `Cmd + L`                 | `Ctrl + L`                 |
| Edit highlighted code        | `Cmd + I`                 | `Ctrl + I`                 |
| Accept diff                  | `Cmd + Shift + Enter`     | `Ctrl + Shift + Enter`     |
| Reject diff                  | `Cmd + Shift + Backspace` | `Ctrl + Shift + Backspace` |

## License

Apache-2.0. Shadow Code is a fork of the Continue open-source project.
