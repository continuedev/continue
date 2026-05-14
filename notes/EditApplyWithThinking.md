# Apply and Edit Modes with Thinking Models

This document explains why the Apply and Edit (Cmd+I) modes are not reliably usable with thinking models, and traces the exact reason through the source code.

---

## What "thinking model" means here

Any model that emits reasoning tokens alongside its regular output:

- **DeepSeek R1 and similar** — reasoning arrives in `delta.reasoning_content` in the SSE stream
- **xAI and others** — reasoning arrives in `delta.reasoning`
- **Anthropic extended thinking** — reasoning arrives as `thinking_delta` content block events

Continue converts all of these to an internal `ChatMessage` with `role: "thinking"` before the rest of the pipeline sees them. From that point on, both the apply path and the edit path are affected identically.

---

## Why thinking content ends up in the file

### The bug: `renderChatMessage()` at `core/util/messageContent.ts:20`

```ts
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

A `role: "thinking"` chunk is converted to plain text identically to a `role: "assistant"` chunk. The reasoning content becomes a string indistinguishable from code output.

### Where `renderChatMessage()` is called on each path

**Apply path and edit-with-rules path (Chat path):**

`streamDiffLines()` feeds the `recursiveStream` generator into `streamLines()` (`core/diff/util.ts:109`):

```ts
const chunk = typeof update === "string" ? update : renderChatMessage(update);
```

The generator yields `ChatMessage` objects (because `streamChat` was called). `renderChatMessage()` is called here, converting `role: "thinking"` chunks to plain text strings.

**Edit-without-rules path (Complete path):**

The prompt is a string (`gptEditPrompt` returns `string`) → `recursiveStream` calls `llm.streamComplete(prompt, { raw: true })`. Inside `OpenAI._streamComplete()` (`OpenAI.ts:423`):

```ts
for await (const chunk of this._streamChat(...)) {
  yield renderChatMessage(chunk);   // ← thinking already converted here
}
```

`renderChatMessage()` is called one layer deeper, inside the provider implementation. By the time the chunk reaches `streamLines()`, it is already a plain `string` — the `role` information is gone. The Continue console shows this path as "Complete" rather than "Chat", but the thinking content is equally mixed in.

In both cases the effect is the same: reasoning text enters the line buffer as plain text alongside the code output.

---

## Why the filters provide no meaningful protection

After `streamLines()`, a filter chain is applied in `streamDiffLines.ts:178`:

```ts
lines = filterEnglishLinesAtStart(lines);
lines = filterCodeBlockLines(lines);
lines = stopAtLines(lines, () => {});
lines = skipLines(lines);
lines = removeTrailingWhitespace(lines);
```

None of these filters have any awareness of `ChatMessage.role`. They operate only on string content.

### `filterEnglishLinesAtStart` — effectively useless against thinking blocks

`filterEnglishLinesAtStart()` (`lineStream.ts:473`) checks only the **very first non-empty line** of the stream. It removes that line only if it starts with one of 9 hardcoded phrases:

```ts
export const ENGLISH_START_PHRASES = [
  "here is",
  "here's",
  "sure, here",
  "sure thing",
  "sure!",
  "to fill",
  "certainly",
  "of course",
  "the code should",
];
```

Or ends in `:` (unless it starts with a code keyword like `def`).

After removing at most that one line (plus an optional blank line after it), all subsequent lines are yielded unconditionally.

Thinking blocks from real reasoning models are typically dozens to hundreds of lines of detailed technical analysis. The filter was designed to strip a single polite preamble line from autocomplete output — it was never intended to handle multi-line reasoning. In practice, only the first line of the thinking block would be suppressed, and only if it happens to start with one of those 9 phrases. The entire remaining reasoning block passes through and enters the diff pipeline.

This is confirmed empirically: thinking content does appear at the beginning of edited/applied files in practice.

### The remaining filters

`filterCodeBlockLines` strips opening/closing ` ``` ` fence markers. `stopAtLines` stops at a closing fence. `skipLines` removes specific known lines. `removeTrailingWhitespace` trims trailing spaces. None of these have any effect on thinking content.

---

## `reasoning: false` has no filtering effect

`recursiveStream` passes `reasoning: false` as an LLM option:

```ts
// recursiveStream.ts:43 / recursiveStream.ts:80
llm.streamComplete(prompt, signal, { raw: true, reasoning: false });
llm.streamChat(messages, signal, { reasoning: false });
```

This option is forwarded to the provider but does not cause thinking chunks to be suppressed. Providers that emit reasoning tokens do so based on the API response fields (`delta.reasoning_content`, `thinking_delta`), not based on this flag. The chunks arrive regardless.

---

## The result

Any reasoning text that passes through the filter chain reaches `streamDiff()`, which compares it against the original file lines. Since reasoning text does not appear in the original file, it is tagged as `DiffLine { type: "new" }` and displayed as a green "Accept" block. When the user accepts (or auto-accept is enabled), it is written into the file as code.

---

## Known issues

**GitHub issue #11590** — "Edit Model failed to apply, but just paste its reasoning process to my code". Filed March 2026, open, no PR linked. Affects the edit (Cmd+I) path with OpenAI models that return `delta.reasoning_content`.

**GitHub issue #10783 / PR #12015** — related but different mechanism. That issue concerns `<think>…</think>` tags embedded directly in `delta.content`. PR #12015 added `stripReasoningFromApplyContent()` in `ApplyManager` to strip those tags. It does **not** address the `role: "thinking"` chunk path documented here.

No issue has been filed specifically for the apply button path.

---

## The fix

### Why a global change to `renderChatMessage()` is not safe

`renderChatMessage()` has one call site that legitimately needs thinking content: `gui/src/pages/gui/Chat.tsx:396`, which explicitly checks `role === "thinking"` and then calls `renderChatMessage()` to populate the `ThinkingBlockPeek` collapsible UI component. Returning `""` globally would break the thinking block display in the chat GUI.

### Proposed fix: new `renderChatMessageWithoutThinking()` function

Add a new function to `core/util/messageContent.ts`:

```ts
export function renderChatMessageWithoutThinking(message: ChatMessage): string {
  if (message.role === "thinking") return "";
  return renderChatMessage(message);
}
```

Replace `renderChatMessage` with `renderChatMessageWithoutThinking` at the following call sites:

**1. `core/diff/util.ts:111`** — `streamLines()`, the Chat-path bug site:

```ts
// before:
const chunk = typeof update === "string" ? update : renderChatMessage(update);
// after:
const chunk =
  typeof update === "string"
    ? update
    : renderChatMessageWithoutThinking(update);
```

**2. All provider `_streamComplete()` implementations** — the Complete-path bug site. Each follows the same pattern; all ten need the change:

| File                          | Line |
| ----------------------------- | ---- |
| `core/llm/llms/OpenAI.ts`     | 433  |
| `core/llm/llms/Anthropic.ts`  | 261  |
| `core/llm/llms/Bedrock.ts`    | 103  |
| `core/llm/llms/Gemini.ts`     | 92   |
| `core/llm/llms/VertexAI.ts`   | 492  |
| `core/llm/llms/Cohere.ts`     | 151  |
| `core/llm/llms/Cloudflare.ts` | 62   |
| `core/llm/llms/Flowise.ts`    | 124  |
| `core/llm/llms/CustomLLM.ts`  | 79   |
| `core/llm/llms/Replicate.ts`  | 68   |

Pattern in each file:

```ts
// before:
yield renderChatMessage(chunk);
// after:
yield renderChatMessageWithoutThinking(chunk);
```

**3. `core/llm/index.ts:967`** — `BaseLLM.chat()` non-streaming aggregation:

```ts
// before:
completion += renderChatMessage(message);
// after:
completion += renderChatMessageWithoutThinking(message);
```

`chat()` is used for one-shot calls (repo map, title generation, etc.). Thinking content merged into the returned `completion` string would corrupt those results.

### Call site that must NOT be changed

**`gui/src/pages/gui/Chat.tsx:396`** — explicitly reads thinking content to display `ThinkingBlockPeek`. Keep `renderChatMessage()` here.

---

## Workaround

Use a non-thinking model for apply and edit by configuring a separate role:

```yaml
models:
  - name: claude-sonnet-4-5   # thinking model, for chat only
    provider: anthropic
    ...
  - name: gpt-4o              # non-thinking model
    provider: openai
    roles: [apply, edit]
    ...
```

`selectedModelByRole.apply ?? selectedModelByRole.chat` (`ApplyManager.ts:129`) means the apply model is used if configured; if not, it falls back to the chat model — which would be the thinking model and trigger the bug.

---

## Key source locations

| File                                                             | Relevance                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `core/util/messageContent.ts:20`                                 | `renderChatMessage()` — `"thinking"` rendered same as `"assistant"` ← **root cause** |
| `core/diff/util.ts:109`                                          | `streamLines()` — calls `renderChatMessage()` on ChatMessage chunks                  |
| `core/llm/llms/OpenAI.ts:423`                                    | `_streamComplete()` — calls `renderChatMessage()` on each chunk from `_streamChat()` |
| `core/autocomplete/filtering/streamTransforms/lineStream.ts:473` | `filterEnglishLinesAtStart()` — strips only the first line if it matches 9 phrases   |
| `core/autocomplete/filtering/streamTransforms/lineStream.ts:183` | `ENGLISH_START_PHRASES` — the 9 hardcoded phrases                                    |
| `core/edit/recursiveStream.ts:43,80`                             | `reasoning: false` passed but has no filtering effect                                |
| `extensions/vscode/src/apply/ApplyManager.ts:129`                | `selectedModelByRole.apply ?? selectedModelByRole.chat` — model selection            |
