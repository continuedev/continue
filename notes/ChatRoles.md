# Message Roles in `/v1/chat/completions` Requests

Continue builds its `messages[]` array from a small set of typed role values. This document describes which roles appear in each mode, when and why, and where the logic lives.

---

## Roles defined internally

Continue's `ChatMessage` union type (`core/index.d.ts:440`) has five variants:

| Role        | Sent to API?                     | Notes                                                             |
| ----------- | -------------------------------- | ----------------------------------------------------------------- |
| `system`    | Yes (as `system` or `developer`) | First message in the array                                        |
| `user`      | Yes                              | Every human turn                                                  |
| `assistant` | Yes                              | Every model turn; may include `tool_calls`                        |
| `tool`      | Yes                              | Tool result; always follows an `assistant` with `tool_calls`      |
| `thinking`  | **No**                           | Internal reasoning; merged into the following `assistant` message |

The `thinking` role is used to store extended-thinking responses (e.g. from Claude) in the conversation history client-side, but `toChatMessage()` (`core/llm/openaiTypeConverters.ts:132`) returns `null` for it — it is never sent to OpenAI as a standalone message. Instead, when a `thinking` message immediately precedes an `assistant` message, its content is injected into that assistant message as `reasoning_content` / `reasoning` / `reasoning_details` fields (provider-dependent).

---

## Chat mode

**Source:** `constructMessages()` (`gui/src/redux/util/constructMessages.ts`) + `getBaseSystemMessage()` (`gui/src/redux/util/getBaseSystemMessage.ts`)

Message sequence sent:

```
system
user
assistant
user
assistant
...
user          ← current turn (last)
```

### `system`

Built from three sources concatenated together:

1. **Base system message** — `DEFAULT_CHAT_SYSTEM_MESSAGE` from `core/llm/defaultSystemMessages.ts` (or the model's custom `baseChatSystemMessage`). Instructs the model it is in chat mode and includes code-block formatting instructions.
2. **Applicable rules** — content from `.continue/rules/*.md` files that match the current files/context, appended via `getSystemMessageWithRules()`.
3. **Conversation summary** (optional) — if the conversation has been compacted (`compactConversation` in `core/util/conversationCompaction.ts`), a `Previous conversation summary:` block is appended.

The system message is omitted entirely when all three sources are empty.

### `user`

Each user turn. Context items (`@`-mentions — files, code snippets, docs, etc.) are prepended as plain-text parts inside the `content` array before the user's typed text. This happens in `constructMessages()` lines 83–99.

### `assistant`

Previous model responses verbatim (content only; no tool calls in chat mode because tools are not active).

---

## Agent mode

**Source:** same `constructMessages()` path, but `getBaseSystemMessage()` returns `DEFAULT_AGENT_SYSTEM_MESSAGE` and tools are passed to the request.

Message sequence sent:

```
system
user
assistant   ← may contain tool_calls[]
tool        ← one per tool call in the preceding assistant message
tool
...
assistant
user
...
```

### `system`

Same structure as chat mode, but:

- Uses `DEFAULT_AGENT_SYSTEM_MESSAGE` (instructs the model it is in agent mode and can call multiple read-only tools simultaneously).
- If no tools are available at runtime, `NO_TOOL_WARNING` is appended: _"THE USER HAS NOT PROVIDED ANY TOOLS, DO NOT ATTEMPT TO USE ANY TOOLS..."_

### `user`

Same as chat mode — typed text with `@`-mention context items prepended.

### `assistant`

When the model decides to call a tool, the assistant message includes a `tool_calls` array. The array entries have the standard OpenAI shape:

```json
{
  "id": "...",
  "type": "function",
  "function": { "name": "...", "arguments": "..." }
}
```

### `tool`

Inserted by `constructMessages()` immediately after each assistant message that has tool call states. One `tool` message per call:

```json
{ "role": "tool", "content": "<tool output text>", "tool_call_id": "..." }
```

The content is the rendered tool output. Special cases:

- Cancelled call → `CANCELLED_TOOL_CALL_MESSAGE`
- Errored call → `ERRORED_TOOL_CALL_OUTPUT_MESSAGE`
- No output yet → `NO_TOOL_CALL_OUTPUT_MESSAGE`

`tool` messages are never sent without a preceding `assistant` that has matching `tool_calls`. During context pruning (`compileChatMessages()` in `core/llm/countTokens.ts:527`), if an `assistant` is pruned, any orphan `tool` messages immediately following it are also pruned.

---

## Edit mode (inline edit / Cmd+I)

**Source:** `streamDiffLines()` (`core/edit/streamDiffLines.ts`) → `recursiveStream()` (`core/edit/recursiveStream.ts`)

The prompt is built by the edit template (`core/llm/templates/edit/gpt.ts` or `core/llm/templates/edit.ts`). Whether it becomes a `string` or `ChatMessage[]` determines which API is used:

| Prompt type                                                    | API call                    | Roles                          |
| -------------------------------------------------------------- | --------------------------- | ------------------------------ |
| `string` (no rules active)                                     | `POST /v1/completions`      | — (not chat/completions)       |
| `string` converted to `ChatMessage[]` because rules are active | `POST /v1/chat/completions` | `system` + `user`              |
| `ChatMessage[]` from template directly                         | `POST /v1/chat/completions` | `user` + `assistant` (prefill) |

### When rules force chat path (`streamDiffLines.ts:115–158`)

If `baseChatSystemMessage` or `.continue/rules/` files are active, the string prompt is wrapped:

```
system   ← rules content
user     ← the full edit prompt (prefix/code/suffix/instruction)
```

### When template returns `ChatMessage[]` directly (e.g. `osModelsEditPrompt`, `defaultApplyPrompt`)

Used when the model supports neither legacy completions nor assistant prefill. Roles:

````
user        ← code context + edit instruction
assistant   ← prefill content, e.g. "```python\n" to force code-only output
````

The `assistant` prefill is a technique to constrain the model to start its response with a code block, avoiding natural-language preamble.

---

## Role mapping for o-series / GPT-5 models

The standard `system` role is **not supported** by OpenAI's o-series (`o1`, `o3`, etc.) and `gpt-5` family models. `formatMessageForO1OrGpt5()` (`core/llm/llms/OpenAI.ts:47`) maps `system → developer` before the request is sent:

```json
{ "role": "developer", "content": "..." }
```

This happens transparently inside `_convertArgs()` whenever `isOSeriesOrGpt5Model(model)` is true. All other roles (`user`, `assistant`, `tool`) remain unchanged.

---

## Message assembly pipeline summary

```
GUI: constructMessages()
    ↓  builds [system?, user, assistant, tool, user, ...]
core/llm/index.ts: compileChatMessages()
    ↓  prunes oldest messages to fit context window
    ↓  always keeps: system, tool sequence at end, latest user/tool turn
core/llm/openaiTypeConverters.ts: toChatBody() / toChatMessage()
    ↓  converts to OpenAI wire format
    ↓  thinking → null (skipped)
    ↓  assistant reasoning fields injected if provider supports it
    ↓  system → developer for o-series
POST /v1/chat/completions
```

---

## Key source locations

| File                                          | Relevance                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `core/index.d.ts:335`                         | `ChatMessageRole` type and all message interfaces                                   |
| `gui/src/redux/util/constructMessages.ts`     | Assembles the full message array from conversation history                          |
| `gui/src/redux/util/getBaseSystemMessage.ts`  | Selects system message text by mode (chat/agent/plan)                               |
| `core/llm/defaultSystemMessages.ts`           | Default system message text for each mode                                           |
| `core/llm/rules/getSystemMessageWithRules.ts` | Appends active `.continue/rules/` to system message                                 |
| `core/llm/countTokens.ts:422`                 | `compileChatMessages()` — context pruning                                           |
| `core/llm/openaiTypeConverters.ts:109`        | `toChatMessage()` — converts each role to OpenAI wire format                        |
| `core/llm/llms/OpenAI.ts:47`                  | `formatMessageForO1OrGpt5()` — maps `system` to `developer`                         |
| `core/edit/streamDiffLines.ts:115`            | Wraps string edit prompt in `system`+`user` when rules are active                   |
| `core/llm/templates/edit/gpt.ts`              | `gptEditPrompt` (returns string) and `defaultApplyPrompt` (returns `ChatMessage[]`) |
