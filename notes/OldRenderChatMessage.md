# Remaining calls to `renderChatMessage` — Why they were not replaced

This document explains every call site where `renderChatMessage` was kept instead of switching to `renderChatMessageWithoutThinking`. The calls fall into five categories.

---

## Category 1 — Input-side calls (user / system / tool messages never contain thinking)

Thinking tokens only appear in _LLM output_, never in user-authored or system messages. These call sites operate exclusively on that kind of content.

### `core/llm/rules/getSystemMessageWithRules.ts:284` and `:307`

Both calls render the **user's message** to extract file paths and code block contents for rule matching. The user message is always `role: "user"` — thinking tokens cannot appear there.

### `core/llm/templates/chat.ts:67` — `llama2TemplateMessages()`

Checks whether the first **system message** is empty before deciding how to format the prompt. System messages never contain thinking content.

### `core/llm/templates/chat.ts:170` — `deepseekTemplateMessages()`

Extracts the **system message** into a local variable. Same reasoning as above.

### `core/llm/llms/Anthropic.ts:160` — `getContentBlocksFromChatMessage()` for `role === "tool"`

This is the `case "tool":` branch of a switch on `message.role`. Tool messages hold the output of function calls — they are never thinking messages. The `"thinking"` role has its own case handled separately further down in the switch.

### `core/llm/llms/OpenAI.ts:531` — legacy completions path

Renders `messages[messages.length - 1]` to pass to the old non-chat completions endpoint. The last message in a chat history is always the user's turn.

---

## Category 2 — Post-`chat()` calls (`BaseLLM.chat()` already strips thinking before returning)

`BaseLLM.chat()` (`core/llm/index.ts:963`) accumulates chunks with `renderChatMessageWithoutThinking` and returns `{ role: "assistant", content: cleanString }`. Any `renderChatMessage` call on that return value operates on an already-clean plain string.

### `core/context/retrieval/repoMapRequest.ts:70`

Renders the response returned by `llm.chat()`. Thinking has already been removed by `chat()` internally, so this call is effectively a no-op string pass-through.

### `core/util/chatDescriber.ts:47`

Same pattern: renders the title string returned by `llm.chat()`. Already clean.

---

## Category 3 — Providers / paths that never produce thinking content

### `core/llm/llms/Ollama.ts:330` — `_convertToOllamaMessage()`

Ollama does not support extended thinking / reasoning tokens, so its message history will never contain a `role: "thinking"` message.

### `core/llm/llms/Replicate.ts:68`

The call only fires for messages where `typeof message.content !== "string"` (i.e., array content). Thinking messages always carry a plain string, so they take the direct-string branch and never reach `renderChatMessage`. Replicate also does not support thinking models.

### `core/llm/index.ts:651` — `streamFim()` (Fill-in-the-Middle)

Renders chunks from the FIM (autocomplete) endpoint. FIM is a completion-style endpoint that does not produce structured thinking blocks.

### `core/llm/templates/chat.ts:257` — `codeLlama70bTemplateMessages()`

Formats prompts for Code Llama 70B — a legacy model incapable of producing thinking tokens.

### `core/llm/countTokens.ts:445` — `compileChatMessages()` image downgrade

Fires only for messages where `Array.isArray(msg.content)` is true (multi-part image messages). Thinking messages carry a `string`, not an array, so this branch is never reached for them.

---

## Category 4 — Logging / debug only (not fed back to any LLM)

### `core/llm/index.ts:577` — `_formatChatMessage()`

Used solely to format messages for interaction logs (written to the logger). The output is never sent to an LLM or displayed to the user as a functional result. Thinking content appearing in a debug log is harmless.

---

## Category 5 — Potentially missed (worth a follow-up)

These sites were **not** replaced, but could produce visible thinking content under certain conditions.

### `core/edit/recursiveStream.ts:88`

Renders chunks from `llm.streamChat()` into a `buffer` that is then used for diff/apply calculation. The request is issued with `reasoning: false` (line 83), which is intended to suppress thinking. However, `reasoning: false` is a best-effort hint — it relies on the provider respecting the flag. If a provider yields a `role: "thinking"` chunk anyway, it gets appended to `buffer` and corrupts the diff. A defensive `renderChatMessageWithoutThinking` here would be safer.

Note: the `chunk` itself is also `yield`-ed upstream (line 87), so thinking chunks would additionally be visible in the UI — the same class of bug that triggered the original fix.

### `core/util/historyUtils.ts:48` — `toMarkDown()`

Exports the full conversation history to a Markdown string. If the history contains `role: "thinking"` messages (which Anthropic extended-thinking models do produce and which can end up in `ChatMessage[]`), their raw content appears in the exported Markdown. This may be intentional (full transcript) or undesirable depending on the use case.

### Legacy slash commands: `review.ts:50`, `commit.ts:21`, `draftIssue.ts:52`, `onboard.ts:51`

All four follow the same pattern: `yield renderChatMessage(chunk)` inside a `streamChat` loop, streaming directly to the chat UI. If a thinking-capable model is configured, thinking blocks will be shown to the user verbatim. These are marked `built-in-legacy` and are probably not tested with modern reasoning models, but the exposure is real.
