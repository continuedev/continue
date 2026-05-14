# `renderChatMessage()` — All Call Sites

**Source:** `core/util/messageContent.ts:20`

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

The function extracts the plain-text content from a `ChatMessage`, stripping any image parts. It is a general-purpose utility used across the codebase in six distinct contexts.

---

## 1. Provider `_streamComplete()` — converting streaming ChatMessage chunks to strings

Every provider's `_streamComplete()` calls `_streamChat()` internally and converts each yielded `ChatMessage` to a plain string via `renderChatMessage()`:

```ts
// OpenAI.ts:423 — same pattern in Bedrock, Cohere, Anthropic, Gemini, VertexAI, Cloudflare, Flowise, CustomLLM, Replicate
for await (const chunk of this._streamChat(...)) {
  yield renderChatMessage(chunk);
}
```

This is the mechanism by which the `streamComplete()` API contract (yields `string`) is fulfilled even though internally the provider uses `_streamChat()` (yields `ChatMessage`). After this conversion, all `role` information is gone — `"thinking"` and `"assistant"` chunks are indistinguishable in the output stream.

**Thinking impact:** On the edit-without-rules path (`gptEditPrompt` → `streamComplete`), thinking content is merged into the plain string stream here, before it reaches `recursiveStream` or `streamLines()`. This is one of the two places that cause the reasoning-in-file bug.

---

## 2. Diff pipeline — `streamLines()`

**Source:** `core/diff/util.ts:111`

```ts
const chunk = typeof update === "string" ? update : renderChatMessage(update);
```

`streamLines()` receives `AsyncGenerator<string | ChatMessage>` from `recursiveStream`. When chunks are `ChatMessage` objects (apply path and edit-with-rules path), `renderChatMessage()` converts them to strings for the line buffer.

**Thinking impact:** This is the second place that causes the reasoning-in-file bug — thinking chunks from `streamChat` are rendered to plain text here and flow into the diff pipeline.

---

## 3. `recursiveStream` — token limit tracking

**Source:** `core/edit/recursiveStream.ts:88`

```ts
const rendered = renderChatMessage(chunk);
buffer += rendered;
totalTokens += countTokens(chunk.content);

if (totalTokens >= safeTokens) {
  throw new Error(
    "Token limit reached. File/range likely too large for this edit",
  );
}
```

On the ChatMessage[] path of `recursiveStream`, the rendered content is accumulated in `buffer` to track how much has been generated. When the total exceeds the safe token budget, an error is thrown. The `buffer` itself is used only for a commented-out recursive continuation feature — the active code only uses it for the token limit check.

---

## 4. `BaseLLM.chat()` — non-streaming aggregation

**Source:** `core/llm/index.ts:967`

```ts
async chat(messages, signal, options) {
  let completion = "";
  for await (const message of this.streamChat(messages, signal, options)) {
    completion += renderChatMessage(message);
  }
  return { role: "assistant", content: completion };
}
```

`chat()` is the non-streaming one-shot LLM call. It collects the full `streamChat` output into a single string. Thinking chunks are merged into `completion` here — so for callers that use `chat()` (repo map, title generation, etc.), thinking content currently ends up in the returned completion string.

---

## 5. Console logging and interaction log

**Source:** `core/llm/index.ts:573` (`_formatChatMessage()`), `core/llm/index.ts:648`

```ts
private _formatChatMessage(msg: ChatMessage): string {
  let contentToShow = renderChatMessage(msg);
  // ... append tool calls if present
  return `<${msg.role}>\n${contentToShow}\n\n`;
}
```

`_formatChatMessage()` is used to display messages in the Continue console and to write entries to the interaction log. The `<role>` prefix in the formatted output is what produces the "thinking" / "assistant" labels visible in the console. This is the only call site where the `role` field is independently used alongside the `renderChatMessage()` result — the role label is added explicitly, not derived from the return value.

The same call site at `index.ts:648` renders each streaming chunk for the interaction log.

---

## 6. GUI — `ThinkingBlockPeek` display

**Source:** `gui/src/pages/gui/Chat.tsx:396`

```ts
if (message.role === "thinking") {
  const thinkingContent = renderChatMessage(message);
  if (!thinkingContent?.trim()) {
    return null;
  }
  return (
    <ThinkingBlockPeek
      content={thinkingContent}
      redactedThinking={message.redactedThinking}
      ...
    />
  );
}
```

This is the **only call site that legitimately needs thinking content from `renderChatMessage()`**. The GUI explicitly checks `role === "thinking"` first and then calls `renderChatMessage()` to extract the content for the collapsible thinking block UI component. Returning `""` for `role: "thinking"` globally would break this display.

---

## Other call sites (summary)

| File                                                       | Purpose                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `core/llm/templates/chat.ts:67,170,257`                    | Building raw prompt strings for non-chat backends — extracts system and user message text for template formatting |
| `core/llm/countTokens.ts:445`                              | Collapses `MessagePart[]` content to string for models that don't support images                                  |
| `core/llm/rules/getSystemMessageWithRules.ts:284,307`      | Extracts user message text to find file paths and match against `.continue/rules/`                                |
| `core/llm/llms/OpenAI.ts:528`                              | Extracts last message content to pass as raw string to the legacy `/v1/completions` endpoint                      |
| `core/llm/llms/Anthropic.ts:156`                           | Extracts message content when building the Anthropic API request body                                             |
| `core/llm/llms/Ollama.ts:330`                              | Sets `ollamaMessage.content` when building the Ollama API request body                                            |
| `core/context/retrieval/repoMapRequest.ts:70`              | Extracts content from a non-streaming LLM response for the repo map                                               |
| `core/util/historyUtils.ts:48`                             | Renders each message to text when exporting chat history to markdown                                              |
| `core/util/chatDescriber.ts:47`                            | Extracts title from an LLM response                                                                               |
| `core/commands/slash/built-in-legacy/commit.ts:21`         | Converts streaming chunks to text for the `/commit` slash command                                                 |
| `core/commands/slash/built-in-legacy/review.ts:50`         | Same for `/review`                                                                                                |
| `core/commands/slash/built-in-legacy/draftIssue.ts:52`     | Same for `/draftIssue`                                                                                            |
| `core/commands/slash/built-in-legacy/onboard.ts:51`        | Same for `/onboard`                                                                                               |
| `gui/src/components/StepContainer/ResponseActions.tsx:119` | Text for the copy-to-clipboard button                                                                             |
| `gui/src/components/StepContainer/StepContainer.tsx:43,84` | Rendering tool output / step content in the GUI                                                                   |
| `gui/src/redux/slices/sessionSlice.ts:545`                 | Session state management                                                                                          |
| `gui/src/redux/thunks/session.ts:218`                      | Session thunk                                                                                                     |

---

## Implication for the reasoning-tokens fix

A global change to return `""` for `role: "thinking"` in `renderChatMessage()` would break `Chat.tsx:396`, which explicitly needs the thinking content to populate `ThinkingBlockPeek`.

The fix must therefore be at the specific call sites in the diff pipeline, not in `renderChatMessage()` itself:

1. **`core/diff/util.ts:109`** (`streamLines()`): skip chunks where `typeof update !== "string" && update.role === "thinking"`:

   ```ts
   if (typeof update !== "string" && update.role === "thinking") continue;
   const chunk =
     typeof update === "string" ? update : renderChatMessage(update);
   ```

2. **Provider `_streamComplete()` implementations** (`OpenAI.ts:423` and equivalents): skip thinking chunks before yielding:
   ```ts
   for await (const chunk of this._streamChat(...)) {
     if (chunk.role === "thinking") continue;
     yield renderChatMessage(chunk);
   }
   ```

These two changes cover both the Chat path and the Complete path without affecting any other call site, including the GUI thinking block display.

---

## Key source locations

| File                              | Line          | Role                                                                            |
| --------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| `core/util/messageContent.ts:20`  | —             | Function definition                                                             |
| `core/diff/util.ts:111`           | diff pipeline | Converts `ChatMessage` chunks to text for `streamLines()` — **bug site 1**      |
| `core/llm/llms/OpenAI.ts:423`     | provider      | `_streamComplete()` converts `_streamChat()` chunks to strings — **bug site 2** |
| `core/edit/recursiveStream.ts:88` | edit/apply    | Token limit buffer accumulation                                                 |
| `core/llm/index.ts:967`           | BaseLLM       | Non-streaming `chat()` aggregation                                              |
| `core/llm/index.ts:573`           | BaseLLM       | Console and interaction log formatting                                          |
| `gui/src/pages/gui/Chat.tsx:396`  | GUI           | **Legitimate thinking use** — populates `ThinkingBlockPeek`                     |
