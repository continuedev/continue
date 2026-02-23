Shell Mode (CLI TUI)

Overview

- Shell mode lets users run shell commands directly from the chat input by starting their input with an exclamation mark (!).
- It is intended for quick terminal command execution without leaving the TUI.

Activation

- Shell mode is activated when the current input (trimmed) starts with !
  - Example: "!git status" or " !ls -la" both activate Shell mode.
- Visual indicator:
  - Input border color changes to yellow.
  - The input prompt indicator changes to a yellow "$".
  - The input placeholder includes "! for shell mode".

Deactivation / Exiting Shell Mode

- Pressing Enter to submit the input exits shell mode immediately after submission, regardless of the command result.
- Pressing Esc when the input (trimmed) is exactly ! clears the input and exits shell mode.
- Editing the input so it no longer starts with ! also exits shell mode and restores normal input behavior.

Interaction with other input helpers

- When in shell mode (input starts with !):
  - "@" file search suggestions are disabled.
  - "/" slash command UI is disabled.
- When in slash command mode (input starts with /):
  - "@" file search suggestions are disabled.
  - Enter submits the highlighted slash command directly (except /title, which requires Tab to select first).
  - Tab selects the highlighted command without submitting.

Submission behavior

- On submit (Enter) with a shell-mode input:
  - The leading ! is removed and the remainder is treated as the shell command to run.
  - The TUI immediately appends an assistant message representing a Shell tool call, with status set to calling, so users can see that the command is in progress.
  - The shell command is executed asynchronously; when it completes, the tool call status is updated to done (or error) and the output is populated.

Execution semantics

- The command is executed in the same way as terminal tool commands, minus permissions, and inserted into the chat history the same.

Output handling

- Stdout is streamed into memory; Stderr is captured and appended as a trailing "Stderr: ..." section on success.
- If the process exits non-zero and Stderr contains content, the tool call is marked as error and the error text is shown.
- Output is truncated to the first 5000 lines if exceeded.
- Timeout behavior: If no output is received for 120 seconds (configurable in tests), the process is terminated and the result includes a note like:
  "[Command timed out after 120 seconds of no output]".

Keyboard behaviors (summary)

- Enter: submit input. If in shell mode, exits shell mode after submission and shows the pending Shell tool call immediately.
- Shift+Enter: new line.
- Backslash (\) at end-of-line: inserts a new line (line continuation) as usual.
- Esc: if only ! (trimmed) is present, clears input and exits shell mode; otherwise cancels streaming or closes suggestions depending on context.

Scope / Modes

- Shell mode applies to interactive (TUI/standard) CLI usage. It is not part of headless (-p/--print) processing.

Error handling

- Command execution errors are captured and surfaced in the tool call as status error with human-readable error text (including Stderr when available).

Examples

- "!git status" → shows a Shell tool call immediately, then populates with the git status output.
- "!echo hello" → shows a Shell tool call immediately, then output "hello".
- "!some-unknown-cmd" → shows a Shell tool call immediately, then sets status to error with an error message.
