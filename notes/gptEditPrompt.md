# How `gptEditPrompt` Works

**Source:** `core/llm/templates/edit/gpt.ts:30`

`gptEditPrompt` is a `PromptTemplateFunction` — it takes `(history: ChatMessage[], otherData: Record<string, string>)` and returns `string | ChatMessage[]`. For edit mode it always returns a plain `string`.

---

## Inputs

`gptEditPrompt` is called via `constructEditPrompt()` in `core/edit/streamDiffLines.ts:29`, which passes:

| `otherData` key | Value                                      |
| --------------- | ------------------------------------------ |
| `prefix`        | Text in the file above the selected region |
| `codeToEdit`    | The selected (highlighted) code region     |
| `suffix`        | Text in the file below the selected region |
| `userInput`     | The user's Cmd+I instruction               |
| `language`      | File language (e.g. `"typescript"`)        |

`history` is always passed as `[]` (empty) for edit mode.

---

## Dispatch logic — three cases

`gptEditPrompt` inspects the inputs and delegates to one of three sub-prompts:

### Case 1 — Insertion (`codeToEdit` is empty)

Delegates to `gptInsertionEditPrompt`. Used when the cursor is positioned between two lines with nothing selected.

Generated prompt:

````
```<language>
<prefix>[BLANK]<suffix>
````

Above is the file of code that the user is currently editing in. Their cursor is
located at the "[BLANK]". They have requested that you fill in the "[BLANK]" with
code that satisfies the following request:

"<userInput>"

Please generate this code. Your output will be only the code that should replace
the "[BLANK]", without repeating any of the prefix or suffix, without any natural
language explanation, and without messing up indentation. Here is the code that
will replace the "[BLANK]":

```

The model is expected to output only the inserted code with no surrounding text.

---

### Case 2 — Full-file rewrite (`prefix` and `suffix` are both empty)

Delegates to `gptFullFileEditPrompt`. Used when the entire file content is selected.

Generated prompt:
```

```<language>
<codeToEdit>
```

Please rewrite the above file to address the following request:

<userInput>

You should rewrite the entire file without any natural language explanation.
DO NOT surround the code in a code block and DO NOT explain yourself.

```

---

### Case 3 — Partial edit (default — prefix or suffix present, and code selected)

Builds a multi-paragraph prompt inline:

```

The user has requested a section of code in a file to be rewritten.

This is the prefix of the file:

```<language>
<prefix>
```

This is the suffix of the file:

```<language>
<suffix>
```

This is the code to rewrite:

```<language>
<codeToEdit>
```

The user's request is: "<userInput>"

DO NOT output any natural language, only output the code changes.

Here is the rewritten code:

```

Prefix and suffix paragraphs are omitted individually if they are empty (e.g. selection starts at line 1 → no prefix paragraph).

---

## How the result is used

`constructEditPrompt()` returns the string to `streamDiffLines()`. Because `gptEditPrompt` always returns a `string`, `recursiveStream.ts` routes it through `llm.streamComplete()` with `raw: true`, which sends the prompt as a single `user` message to `POST /v1/chat/completions`.

---

## How `renderPromptTemplate` invokes it

`constructEditPrompt()` does not call `gptEditPrompt` directly — it goes via `llm.renderPromptTemplate()` (`core/llm/index.ts:1486`). That method:

1. Detects that `template` is a function (not a Handlebars string).
2. Calls `template(history, { ...otherData, supportsCompletions, supportsPrefill })`.
3. Gets back a `string` (since `gptEditPrompt` always returns a string for edit mode).
4. Returns it as-is.

The `supportsCompletions` / `supportsPrefill` flags added by `renderPromptTemplate` are not used by `gptEditPrompt` itself, but are part of the standard `otherData` contract for all `PromptTemplateFunction` implementations.

---

## Key source locations

| File | Relevance |
|---|---|
| `core/llm/templates/edit/gpt.ts:30` | `gptEditPrompt` — main function |
| `core/llm/templates/edit/gpt.ts:4` | `gptInsertionEditPrompt` — Case 1 |
| `core/llm/templates/edit/gpt.ts:17` | `gptFullFileEditPrompt` — Case 2 |
| `core/edit/streamDiffLines.ts:29` | `constructEditPrompt()` — assembles `otherData` and calls `renderPromptTemplate` |
| `core/llm/index.ts:1486` | `renderPromptTemplate()` — dispatches to function or Handlebars |
```
