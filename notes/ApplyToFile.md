# Apply Mode

Apply mode merges a code block that was already generated in the chat response into an existing file. It is completely separate from inline edit mode (Cmd+I), which takes a user instruction and edits code in place.

---

## Trigger

When the LLM generates a code block in chat, a toolbar appears above it. Clicking **"Apply"** posts an `applyToFile` message to the VS Code extension (`VsCodeMessenger.ts:142`) with the code block text and the target file path. The extension opens the file, captures its current content, and calls `applyCodeBlock()`.

---

## Three strategies (tried in order)

### 1. Deterministic instant apply

**Source:** `core/edit/lazy/applyCodeBlock.ts:24`

For tree-sitter supported file extensions, Continue attempts `deterministicApplyLazyEdit()` — an AST-based approach that matches code patterns and replaces them without calling the LLM. Fast and free.

### 2. Unified diff format

**Source:** `core/edit/lazy/applyCodeBlock.ts:41`

If the code block is in unified diff format (`--- a/... +++ b/...`), `applyUnifiedDiff()` applies it directly. Also no LLM call.

### 3. LLM-powered apply (fallback)

When neither deterministic nor diff approaches succeed, the LLM is invoked. Two prompt variants exist, both starting with `ORIGINAL CODE:`:

#### Sonnet lazy apply — `claudeSonnetLazyApplyPrompt` (`core/edit/lazy/prompts.ts:25`)

````
ORIGINAL CODE:
```<filename>
<full file content>
````

NEW CODE:

```
<code block from chat>
```

Above is a code block containing the original version of a file (ORIGINAL CODE) and below it is a code snippet (NEW CODE)...

- Whenever any part of the code is the same as before, you may simply indicate this with a comment that says "UNCHANGED CODE"...

```

The model only rewrites changed sections and writes `// UNCHANGED CODE` for unchanged parts. Continue's `streamFillUnchangedCode()` (`streamLazyApply.ts:72`) detects those markers and splices in the original lines. This avoids outputting the full file for large files. Uses `llm.streamChat()` directly.

#### Full rewrite — `defaultApplyPrompt` (`core/llm/templates/edit/gpt.ts:75`)

```

ORIGINAL CODE:

```
<full file content>
```

SUGGESTED EDIT:

```
<code block from chat>
```

Apply the SUGGESTED EDIT to the ORIGINAL CODE. Output the complete modified file.

- Output ONLY code. Do NOT explain, summarize, or describe changes.
- Leave existing comments in place unless changes require modifying them.
- Preserve all unchanged code exactly as-is.

````

The assistant prefill is ` ``` ` — the model is constrained to start its response with a code block. Used for non-Sonnet models via `streamDiffLines()` with `type = "apply"`.

---

## Model selection

**Source:** `extensions/vscode/src/apply/ApplyManager.ts:130`

```ts
config.selectedModelByRole.apply ?? config.selectedModelByRole.chat
````

A dedicated apply model can be configured in `config.yaml` with `roles: [apply]`. If none is configured, the currently selected chat model is used. In `config-example.yaml` all four models include `apply` in their roles.

---

## Key source locations

| File                                                                             | Relevance                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `extensions/vscode/src/apply/ApplyManager.ts:28`                                 | Entry point — receives `applyToFile`, routes to the right strategy                         |
| `core/edit/lazy/applyCodeBlock.ts:14`                                            | Tries deterministic → unified diff → LLM fallback                                          |
| `core/edit/lazy/streamLazyApply.ts:14`                                           | LLM-powered lazy apply for Sonnet — `streamChat` with lazy prompt                          |
| `core/edit/lazy/prompts.ts:25`                                                   | `claudeSonnetLazyApplyPrompt` — "ORIGINAL CODE" + "NEW CODE" with "UNCHANGED CODE" markers |
| `core/llm/templates/edit/gpt.ts:75`                                              | `defaultApplyPrompt` — "ORIGINAL CODE" + "SUGGESTED EDIT", full rewrite                    |
| `core/edit/streamDiffLines.ts:47`                                                | `constructApplyPrompt()` — selects `llm.promptTemplates?.apply ?? defaultApplyPrompt`      |
| `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/index.tsx:191` | "Apply" button click handler in the GUI                                                    |
