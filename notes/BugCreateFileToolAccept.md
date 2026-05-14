# Bug: `create_new_file` Tool — "Create file" Button Conflicts with Tool Approval

## Summary

When the `create_new_file` tool is invoked by the agent and its policy is `allowedWithPermission`, the chat shows both a "Create file" button (in the code block toolbar) and an "Accept"/"Reject" button pair (in the `PendingToolCallToolbar`). These two mechanisms create the file independently and are not coordinated. Clicking "Create file" creates the file but leaves the tool call orphaned; clicking "Accept" afterwards fails with a `FileAlreadyExists` error and sends that error to the LLM.

---

## How the two mechanisms arise

### Mechanism 1 — "Accept" button (`PendingToolCallToolbar`)

**Source:** `gui/src/components/mainInput/Lump/LumpToolbar/PendingToolCallToolbar.tsx:26`

When a tool call has policy `allowedWithPermission`, `streamNormalInput` calls `dispatch(setInactive())` and waits for user input. `PendingToolCallToolbar` renders Accept/Reject buttons for all tool calls with status `"generated"`. Clicking "Accept":

```
callToolById({ toolCallId })
  → ideMessenger.request("tools/call", { toolCall })
  → core: callTool() → callBuiltInTool("create_new_file")
  → createNewFileImpl: ide.writeFile() → ide.openFile() → ide.saveFile()
  → returns ContextItem[]
streamResponseAfterToolCall()
  → adds { role: "tool", content: "File created successfully" } to history
  → calls streamNormalInput() — agent continues
```

This is the correct path. The file is created and the agent loop resumes.

### Mechanism 2 — "Create file" button (code block toolbar)

**Source:** `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/index.tsx:285`

`FunctionSpecificToolCallDiv` (`gui/src/pages/gui/ToolCallDiv/FunctionSpecificToolCallDiv.tsx:21`) matches `BuiltInToolNames.CreateNewFile` and renders `<CreateFile>`:

```tsx
<CreateFile
  relativeFilepath={args?.filepath ?? ""}
  fileContents={args?.contents ?? ""}
  historyIndex={historyIndex}
/>
```

`CreateFile` (`gui/src/pages/gui/ToolCallDiv/CreateFile.tsx:10`) renders the file contents as a fenced code block via `StyledMarkdownPreview` with `disableManualApply`:

```tsx
<StyledMarkdownPreview
  isRenderingInStepContainer
  disableManualApply // ← intended to suppress the Apply button
  source={src}
  itemIndex={props.historyIndex}
/>
```

`StepContainerPreToolbar.renderActionButtons()` (`index.tsx:242`) checks whether the referenced file exists:

```ts
if (fileExists || !relativeFilepath) {
  return <ApplyActions disableManualApply={disableManualApply} ... />;
  // ApplyActions returns null when disableManualApply is true and status is "closed"
}
return <CreateFileButton onClick={onClickApply} />;  // ← reached regardless of disableManualApply
```

Because the file does not yet exist, the `fileExists` branch is skipped and `CreateFileButton` is rendered. `disableManualApply` only controls `ApplyActions` — it is never checked in the `CreateFileButton` branch.

Clicking "Create file":

```ts
// StepContainerPreToolbar/index.tsx:180
async function onClickApply() {
  const fileUri = await getFileUriToApplyTo();
  ideMessenger.post("applyToFile", {
    streamId,
    filepath: fileUri,
    text: codeBlockContent,
  });
}
```

This goes through `ApplyManager.applyToFile()` and writes the file. **`callToolById` is never dispatched.** The tool call remains in status `"generated"`.

---

## The conflict

After clicking "Create file":

- The file exists on disk.
- The tool call status is still `"generated"` — the agent is stuck, waiting for approval.
- `PendingToolCallToolbar` still shows "Accept"/"Reject".

If the user then clicks "Accept":

```
callToolById → createNewFileImpl → ide.fileExists() → true
→ throw new ContinueError(ContinueErrorReason.FileAlreadyExists,
    "File X already exists. Use the edit tool to edit this file")
```

`callToolById` catches the error, sets the tool call to `"errored"`, and (since `streamResponse = true` for core tools) still calls `streamResponseAfterToolCall`. The LLM receives an error context item it didn't cause, which may produce a confused response.

If the user never clicks "Accept" after clicking "Create file", the agent remains inactive indefinitely — the file exists but the tool call is never resolved and the loop never resumes.

---

## Root cause

`disableManualApply` was introduced to prevent the standard code-block "Apply" button from patching an existing file when the code block is rendered as part of a tool call. It correctly suppresses `ApplyActions` but does not cover the `CreateFileButton` branch in `renderActionButtons()`, which is conditionally rendered based solely on whether `fileExists` is false — a condition that is always true for a `create_new_file` tool call.

**Source:** `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/index.tsx:283-285`

---

## Fix suggestion

### Option A — Suppress `CreateFileButton` when `disableManualApply` is set (minimal fix)

In `StepContainerPreToolbar/index.tsx`, extend the `disableManualApply` check to also gate the `CreateFileButton`:

```ts
// index.tsx:283
if (fileExists || !relativeFilepath) {
  return <ApplyActions disableManualApply={disableManualApply} ... />;
}

if (disableManualApply) {
  return null;  // ← add this
}
return <CreateFileButton onClick={onClickApply} />;
```

Effect: when `CreateFile` renders the code block inside a tool call, neither "Apply" nor "Create file" appears. The only affordance is the `PendingToolCallToolbar`'s "Accept"/"Reject" buttons, which correctly go through `callToolById` → `createNewFileImpl` → LLM continuation. The code block is purely informational — a preview of what will be created.

### Option B — Make "Create file" the approval action (richer fix)

Wire the `CreateFileButton` click to `callToolById` when the code block is rendered inside a pending tool call. This would require passing the `toolCallId` down through `CreateFile` → `StyledMarkdownPreview` → `StepContainerPreToolbar` and dispatching `callToolById` instead of `applyToFile` when it is set. The tool execution (`createNewFileImpl`) then creates the file and the agent loop resumes — a single click handles both approval and execution.

This is the better UX (one action instead of two) but requires more wiring. It would also make `createNewFile` behave consistently with the edit tools, which similarly use a single user action to approve and execute.

---

## Key source locations

| File                                                                                   | Line | Relevance                                                                    |
| -------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `gui/src/pages/gui/ToolCallDiv/CreateFile.tsx:10`                                      | —    | Renders code block with `disableManualApply`                                 |
| `gui/src/pages/gui/ToolCallDiv/FunctionSpecificToolCallDiv.tsx:21`                     | —    | Routes `create_new_file` to `<CreateFile>`                                   |
| `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/index.tsx:283`       | —    | `CreateFileButton` shown regardless of `disableManualApply` — **root cause** |
| `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/ApplyActions.tsx:60` | —    | `disableManualApply` suppresses "Apply" but only inside `ApplyActions`       |
| `gui/src/components/mainInput/Lump/LumpToolbar/PendingToolCallToolbar.tsx:26`          | —    | "Accept" dispatches `callToolById` — the correct approval path               |
| `core/tools/implementations/createNewFile.ts:19`                                       | —    | `ide.fileExists()` check throws `FileAlreadyExists` if file already present  |
| `core/tools/definitions/createNewFile.ts:36`                                           | —    | `defaultToolPolicy: "allowedWithPermission"` — requires user approval        |
