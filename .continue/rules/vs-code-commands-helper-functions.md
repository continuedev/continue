---
globs: "extensions/vscode/src/commands.ts"
---

When adding new commands to the commands map, always create a separate helper function for the command logic instead of defining it inline. Follow the pattern of existing commands like `streamInlineEdit` - define the helper function below the commands map, then call it from within the command entry.
