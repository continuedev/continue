# Bug: Reasoning Tokens Written to File — Full Code Path

This document traces how reasoning tokens from the LLM API end up as text written into a source file, starting from the user pressing the Apply button. There are two affected paths: the **apply path** (Apply button on a chat code block) and the **edit path** (Cmd+I). Both converge at the same broken line.

---

## Part 1 — From Apply button to LLM call

### A. GUI: Apply button click

The Apply button lives in `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/index.tsx:180`. Clicking it resolves the target file URI and posts a message to the IDE:

```ts
// StepContainerPreToolbar/index.tsx:191
ideMessenger.post("applyToFile", {
  streamId: codeBlockStreamId,
  filepath: fileUri,
  text: codeBlockContent, // ← the code block text from the chat response
});
```

`codeBlockContent` is the raw text of the code block as it appeared in the chat — no reasoning has been involved yet at this stage.

### B. VS Code extension receives the message

`VsCodeMessenger` (`extensions/vscode/src/extension/VsCodeMessenger.ts:142`) listens for `"applyToFile"` webview messages:

```ts
// VsCodeMessenger.ts:142
this.onWebview("applyToFile", async ({ data }) => {
  const applyManager = new ApplyManager(
    this.ide,
    webviewProtocol,
    verticalDiffManager,
    configHandler,
  );
  await applyManager.applyToFile(data);
});
```

### C. `ApplyManager.applyToFile()` — entry point

`ApplyManager.applyToFile()` (`extensions/vscode/src/apply/ApplyManager.ts:28`) opens the target file if it doesn't exist, notifies the GUI that streaming has started (`updateApplyState: "streaming"`), then dispatches based on whether the file already has content:

```ts
// ApplyManager.ts:68
await this.handleExistingDocument(activeTextEditor, text, streamId, toolCallId);
```

### D. `handleExistingDocument()` — LLM selection and strategy dispatch

`handleExistingDocument()` (`ApplyManager.ts:117`) selects the LLM:

```ts
// ApplyManager.ts:129
const llm = config.selectedModelByRole.apply ?? config.selectedModelByRole.chat;
```

It then calls `applyCodeBlock()` to attempt the cheap strategies first:

```ts
// ApplyManager.ts:142
const { isInstantApply, diffLinesGenerator } = await applyCodeBlock(
  editor.document.getText(), // current file content
  text, // code block from chat
  getUriPathBasename(fileUri),
  llm,
  abortController,
);
```

### E. `applyCodeBlock()` — three strategies, falling through to LLM

`applyCodeBlock()` (`core/edit/lazy/applyCodeBlock.ts:14`) tries two LLM-free strategies:

1. **Deterministic AST-based** (`applyCodeBlock.ts:25`): tree-sitter pattern matching. Returns `isInstantApply: true` if it succeeds.
2. **Unified diff** (`applyCodeBlock.ts:41`): if the code block is already in `--- a/ +++ b/` format. Returns `isInstantApply: true` if it succeeds.

If both fail, it returns:

```ts
// applyCodeBlock.ts:53
return {
  isInstantApply: false,
  diffLinesGenerator: streamLazyApply(
    oldFile,
    filename,
    newLazyFile,
    llm,
    abortController,
  ),
};
```

**Note:** the `streamLazyApply` generator is created here but is **never iterated**. Back in `handleExistingDocument`, when `isInstantApply` is `false`, the `diffLinesGenerator` is discarded and `handleNonInstantDiff()` is called instead. `streamLazyApply` is dead code on this path.

### F. `handleNonInstantDiff()` → `verticalDiffManager.streamEdit()`

`handleNonInstantDiff()` (`ApplyManager.ts:208`) builds a plain-text apply prompt and delegates to the vertical diff manager:

```ts
// ApplyManager.ts:235
await verticalDiffManager.streamEdit({
  input: this.getApplyPrompt(text), // "The following code was suggested..."
  llm,
  range: rangeToApplyTo, // full file range (or current selection)
  newCode: text,
  rulesToInclude: undefined,
  isApply: true,
});
```

### G. `VerticalDiffManager.streamEdit()` → `streamDiffLines()`

`streamEdit()` (`extensions/vscode/src/diff/vertical/manager.ts:357`) computes the prefix, suffix, and range content from the active editor, then calls:

```ts
// manager.ts:534
const stream = streamDiffLines(
  {
    highlighted: rangeContent,
    prefix,
    suffix,
    input,
    language: getMarkdownLanguageTagForFile(fileUri),
    type: "apply",            // ← isApply: true
    newCode: newCode ?? "",
    ...
  },
  llm,
  abortController,
  overridePrompt,
  rulesToInclude,
);
```

### H. `streamDiffLines()` — prompt construction and LLM dispatch

`streamDiffLines()` (`core/edit/streamDiffLines.ts:77`) constructs the apply prompt. Because `overridePrompt` is `undefined` and `type === "apply"`, it calls `constructApplyPrompt()`:

```ts
// streamDiffLines.ts:109
let prompt =
  overridePrompt ??
  (type === "apply"
    ? constructApplyPrompt(oldLines.join("\n"), options.newCode, llm)
    : constructEditPrompt(...));
```

`constructApplyPrompt()` (`streamDiffLines.ts:47`) resolves to `defaultApplyPrompt` (from `core/llm/templates/edit/gpt.ts:75`) since no custom `apply` template is configured. `defaultApplyPrompt` returns a `ChatMessage[]`:

````
user:      ORIGINAL CODE: ```...```  SUGGESTED EDIT: ```...```  Apply the SUGGESTED EDIT...
assistant: ```
````

This `ChatMessage[]` is passed to `recursiveStream()`:

```ts
// streamDiffLines.ts:168
const completion = recursiveStream(
  llm,
  abortController,
  type,
  prompt,
  prediction,
);
```

The LLM is invoked inside `recursiveStream`. **This is where reasoning tokens enter the stream** — continue to Part 2.

---

## Part 2 — From LLM response to file

### Step 1 — API response: reasoning arrives in a dedicated field

For providers that support extended reasoning, the streaming response includes reasoning content in a field separate from the regular text content.

**DeepSeek and xAI** return it in the SSE chunk delta:

```json
{ "delta": { "reasoning_content": "Let me think about this..." } }
```

**Anthropic** yields it as a dedicated stream event type:

```
event: content_block_delta
data: { "delta": { "type": "thinking_delta", "thinking": "Let me think..." } }
```

### Step 2 — Provider layer converts to internal `role: "thinking"`

#### OpenAI-compatible providers (DeepSeek, xAI, gpt-5.x, etc.)

`OpenAI._streamChat()` (`core/llm/llms/OpenAI.ts:562`) iterates the SSE stream and calls `fromChatCompletionChunk(value)` on each chunk:

```ts
// OpenAI.ts:562
for await (const value of streamSse(response)) {
  const chunk = fromChatCompletionChunk(value);
  if (chunk) {
    yield chunk;
  }
}
```

`fromChatCompletionChunk()` (`core/llm/openaiTypeConverters.ts:384`) checks for reasoning fields:

```ts
// openaiTypeConverters.ts:384
} else if (
  delta?.reasoning_content ||
  delta?.reasoning ||
  delta?.reasoning_details?.length
) {
  const message: ThinkingChatMessage = {
    role: "thinking",
    content: delta.reasoning_content || delta.reasoning || "",
    ...
  };
  return message;
}
```

Any chunk carrying `reasoning_content` or `reasoning` is yielded as a `ChatMessage` with `role: "thinking"`.

#### Anthropic

`Anthropic._streamChat()` (`core/llm/llms/Anthropic.ts:353`) handles `thinking_delta` events directly:

```ts
// Anthropic.ts:353
case "thinking_delta":
  yield {
    role: "thinking",
    content: blockDeltaEvent.delta.thinking,
  };
  break;
```

Redacted thinking blocks are also yielded as `role: "thinking"` at `Anthropic.ts:338`.

From this point both providers produce an identical stream: a mix of `{ role: "assistant", content: "..." }` and `{ role: "thinking", content: "..." }` chunks.

### Step 3 — `recursiveStream` yields every chunk without filtering

`recursiveStream()` (`core/edit/recursiveStream.ts:80`) calls the LLM and re-yields every chunk it receives:

```ts
// recursiveStream.ts:80
const generator = llm.streamChat(promptMessages, abortController.signal, {
  raw: true,
  prediction: undefined,
  reasoning: false,   // ← passed as option but has no filtering effect here
});

for await (const chunk of generator) {
  yield chunk;        // ← thinking chunks pass through unchanged
  ...
}
```

The `reasoning: false` option is forwarded to the LLM but does not cause the provider to suppress `role: "thinking"` chunks — those are emitted based on the API response fields, not on this flag. Every chunk, regardless of role, is yielded to the caller.

### Step 4 — `streamLines` renders every chunk to text, role-blind

Back in `streamDiffLines()`, the `recursiveStream` generator is fed into `streamLines()`:

```ts
// streamDiffLines.ts:176
let lines = streamLines(completion);
```

`streamLines()` (`core/diff/util.ts:100`) converts every chunk to a string:

```ts
// diff/util.ts:109
for await (const update of streamCompletion) {
  const chunk =
    typeof update === "string" ? update : renderChatMessage(update);
  buffer += chunk;
  ...
}
```

`renderChatMessage()` (`core/util/messageContent.ts:20`) is where the bug materialises:

```ts
// messageContent.ts:20
export function renderChatMessage(message: ChatMessage): string {
  switch (message?.role) {
    case "user":
    case "assistant":
    case "thinking":    // ← same branch as "assistant"
    case "system":
      return stripImages(message.content);
    ...
  }
}
```

A `role: "thinking"` chunk is rendered to plain text identically to a `role: "assistant"` chunk. The reasoning content is concatenated into the line buffer and becomes indistinguishable from code output.

### Step 5 — Line filters have no role awareness

After `streamLines`, a chain of filters is applied (`streamDiffLines.ts:178`):

```ts
lines = filterEnglishLinesAtStart(lines);
lines = filterCodeBlockLines(lines);
lines = stopAtLines(lines, () => {});
lines = skipLines(lines);
lines = removeTrailingWhitespace(lines);
```

None of these filters know that a line originated from a reasoning chunk. They operate purely on string content. `filterEnglishLinesAtStart` removes natural-language prose at the very start of the stream, which might incidentally discard some reasoning output — but only if it appears before the first code line and does not contain code-like characters. Reasoning interleaved with or after code output passes through unfiltered.

### Step 6 — `streamDiff` produces diff lines that include reasoning text

The filtered line stream is passed to `streamDiff()` (`streamDiffLines.ts:188`):

```ts
let diffLines = streamDiff(oldLines, lines);
```

`streamDiff` compares the incoming lines against the original file lines and emits `DiffLine` entries tagged `"new"`, `"old"`, or `"same"`. Reasoning text that survived the filters is treated as new code lines, tagged `"new"`, displayed as "Accept / Reject" blocks in the editor, and written to the file when accepted (or auto-accepted).

---

## Complete call chains

### Apply path (Apply button, LLM fallback)

````
GUI StepContainerPreToolbar/index.tsx:191
  ideMessenger.post("applyToFile", { filepath, text: codeBlockContent })
VsCodeMessenger.ts:142
  onWebview("applyToFile") → new ApplyManager() → applyManager.applyToFile(data)
ApplyManager.ts:28  applyToFile()
  → handleExistingDocument()                                      ApplyManager.ts:117
      llm = selectedModelByRole.apply ?? selectedModelByRole.chat ApplyManager.ts:129
      applyCodeBlock(fileContent, text, filename, llm, ...)       ApplyManager.ts:142
        deterministicApplyLazyEdit()  → fails                     applyCodeBlock.ts:25
        applyUnifiedDiff()            → fails                     applyCodeBlock.ts:41
        return { isInstantApply: false, ... }                     applyCodeBlock.ts:53
      isInstantApply === false
      → handleNonInstantDiff(editor, text, llm, ...)              ApplyManager.ts:158
          verticalDiffManager.streamEdit({ isApply: true, newCode: text, ... })
                                                                  ApplyManager.ts:235
            streamDiffLines({ type:"apply", newCode: text, ... }) manager.ts:534
              constructApplyPrompt() → defaultApplyPrompt         streamDiffLines.ts:109
                → ChatMessage[user: ORIGINAL+SUGGESTED, assistant: "```"]
              recursiveStream(llm, ..., prompt=ChatMessage[])     streamDiffLines.ts:168
                llm.streamChat(promptMessages)                    recursiveStream.ts:80
                  OpenAI._streamChat():562 / Anthropic._streamChat():353
                  → yields { role:"thinking", content:"..." }     ← reasoning enters
                yield chunk  (thinking chunks pass through)       recursiveStream.ts:86
              streamLines(completion)                             streamDiffLines.ts:176
                renderChatMessage(chunk)                          diff/util.ts:111
                  case "thinking": return stripImages(content)    messageContent.ts:24 ← BUG
              filterEnglishLinesAtStart / filterCodeBlockLines / ...
              streamDiff → DiffLine{ type:"new", line:<reasoning text> }
              → written to file as accepted diff
````

### Edit path (Cmd+I, no rules)

```
User triggers Cmd+I inline edit
VerticalDiffManager.streamEdit({ isApply: false, ... })          manager.ts:357
  streamDiffLines({ type:"edit", ... })                          manager.ts:534
    constructEditPrompt() → gptEditPrompt → string               streamDiffLines.ts:113
    recursiveStream(llm, ..., prompt=string)                     streamDiffLines.ts:168
      llm.streamComplete(prompt, { raw:true, reasoning:false })  recursiveStream.ts:43
        OpenAI._streamComplete() → _streamChat()
        OpenAI._streamChat():562  yields { role:"thinking", ... }
      yield chunk                                                 recursiveStream.ts:49
    streamLines(completion)                                       streamDiffLines.ts:176
      renderChatMessage(chunk)                                    diff/util.ts:111
        case "thinking": return stripImages(content)             messageContent.ts:24 ← BUG
    → same path to streamDiff / DiffLine as apply path
```

### Edit path (Cmd+I, rules active)

```
constructEditPrompt() → gptEditPrompt → string
  → wrapped in [system, user]                                    streamDiffLines.ts:138
recursiveStream(llm, ..., prompt=ChatMessage[])                  streamDiffLines.ts:168
  llm.streamChat(messages, { reasoning:false })                  recursiveStream.ts:80
  → same as apply path from here onward
```

---

## The fix

The bug has a single root: `renderChatMessage()` at `core/util/messageContent.ts:24` places `"thinking"` in the same `case` as `"assistant"`. The minimal fix is to return `""` for `role: "thinking"` in that function — or more precisely at the call site in `diff/util.ts:111`. Returning `""` means reasoning chunks contribute nothing to the line buffer and are silently dropped, exactly as `toChatMessage()` already does when serialising conversation history back to the API (`openaiTypeConverters.ts:132`, which returns `null` for `role: "thinking"`).
