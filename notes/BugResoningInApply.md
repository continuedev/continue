# Bug: Reasoning Tokens Land in Target File During Apply

## How reasoning content becomes `role: "thinking"`

Reasoning tokens do not arrive as a separate message with a special role at the API level. They arrive in the same delta object as regular content, just in a different field:

- **DeepSeek**: `delta.reasoning_content`
- **xAI and others**: `delta.reasoning`
- **Anthropic**: genuine separate `thinking` content blocks in the response stream

Continue converts all of these into a synthetic internal `ChatMessage` with `role: "thinking"` in `core/llm/openaiTypeConverters.ts:384-395`:

```ts
} else if (delta?.reasoning_content || delta?.reasoning || ...) {
  return {
    role: "thinking",
    content: delta.reasoning_content || delta.reasoning || "",
    ...
  };
}
```

Anthropic's thinking blocks are mapped to the same internal type in `core/llm/llms/Anthropic.ts:340,355,361`.

`role: "thinking"` is Continue's internal representation only — it does not exist as a wire format in any provider's API.

---

## Why reasoning tokens end up in the target file

`renderChatMessage()` (`core/util/messageContent.ts:20`) treats `role: "thinking"` identically to `role: "assistant"`:

```ts
case "assistant":
case "thinking":   // ← same branch
  return stripImages(message.content);
```

`streamLines()` (`core/diff/util.ts:100`) converts every chunk from the LLM response — whether `string` or `ChatMessage` — to text using `renderChatMessage`:

```ts
const chunk = typeof update === "string" ? update : renderChatMessage(update);
```

So reasoning chunks are rendered to plain text and concatenated into the line buffer exactly like regular assistant output. None of the downstream filters (`filterCodeBlockLines`, `stopAtLines`, etc.) have any awareness that the content originated from reasoning tokens. The thinking content flows through the diff pipeline and gets written into the target file.

The `reasoning: false` option passed in `recursiveStream` (`core/edit/recursiveStream.ts:46,83`) does not filter out thinking chunks — it is passed as an LLM option but chunks with `role: "thinking"` still arrive from providers that emit reasoning unconditionally.

---

## Key source locations

| File                                     | Relevance                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `core/llm/openaiTypeConverters.ts:384`   | Converts `reasoning_content`/`reasoning` delta fields to `role: "thinking"`   |
| `core/llm/llms/Anthropic.ts:340,355,361` | Converts Anthropic thinking blocks to `role: "thinking"`                      |
| `core/util/messageContent.ts:24`         | `renderChatMessage` — `role: "thinking"` rendered same as `role: "assistant"` |
| `core/diff/util.ts:111`                  | `streamLines` — calls `renderChatMessage` on every chunk without role check   |
| `core/edit/recursiveStream.ts:46,83`     | `reasoning: false` passed but does not filter out thinking chunks             |

---

## Related GitHub issues

### Issue #11590 — same bug, edit path only

**Title:** "Edit Model failed to apply, but just paste its reasoning process to my code"  
**Reporter:** Z2IRIM, March 18 2026, open, no PR linked.

Models: `gpt-5.4-mini` and `gpt-5.3-codex` via OpenAI provider. These return reasoning in `delta.reasoning_content` (API-level field), which Continue maps to `role: "thinking"`. The issue log explicitly shows `"thinking"` tags appearing in the edit output. This is the exact same mechanism as our bug, but limited to the **edit (Cmd+I) path**.

### Apply button path — no issue filed

The Apply button (`defaultApplyPrompt` / `claudeSonnetLazyApplyPrompt`) feeds the LLM response through the same `streamLines()` → `renderChatMessage()` pipeline, so it is equally vulnerable: if the apply model emits `delta.reasoning_content` or `delta.reasoning`, the reasoning text will be written into the target file. No GitHub issue exists for this specific scenario. A search across all `reasoning`/`thinking`/`apply` issues confirmed the gap — the closest is #10783, which covers a different mechanism (content-level `<think>` tags, addressed by PR #12015).

### Issue #10783 / PR #12015 — related but different

**Title:** "Apply/edit writes raw model reasoning into files instead of filtering"  
Model: `gpt-oss-20b-gguf` via LM Studio (OpenAI-compatible).

The model embeds reasoning as `<think>…</think>` tags or Harmony protocol tokens (`<|channel|>`, `<|constrain|>`) directly in `delta.content`. These never go through the `role: "thinking"` path. PR #12015 fixes this by adding a `stripReasoningFromApplyContent()` string sanitizer in `ApplyManager`. This fix does **not** address our bug.

---

## Proposed workaround in #11590 (Z2IRIM, March 19 2026) — insufficient

Z2IRIM suggested suppressing reasoning at the API level via:

```yaml
requestOptions:
  extraBodyProperties:
    reasoning_effort: "none"
```

### Does `extraBodyProperties` actually reach the API?

Yes — but not through `OpenAI.extraBodyProperties()` (which always returns `{}`). The merge happens in `packages/fetch/src/fetch.ts:147`:

```ts
if (requestOptions?.extraBodyProperties && typeof init?.body === "string") {
  const parsedBody = JSON.parse(init.body);
  updatedBody = JSON.stringify({
    ...parsedBody,
    ...requestOptions.extraBodyProperties,
  });
}
```

`BaseLLM.fetch()` (`core/llm/index.ts:472`) passes `this.requestOptions` to `fetchwithRequestOptions`, so the property does get serialized into the HTTP request body.

### Is there a native `reasoning.effort` config key?

No. The only occurrence of `reasoning: { effort: "medium" }` in the codebase is in `OpenAI._convertArgsResponses()` (`core/llm/llms/OpenAI.ts:333`) — hardcoded for the Responses API path, not the Chat Completions path. There is no `reasoningEffort` field in `CompletionOptions` or `toChatBody()`.

### Why the workaround is unreliable

1. **`"none"` is not a documented value.** OpenAI's API accepts `"low" | "medium" | "high"` for `reasoning_effort`. Sending `"none"` may be silently ignored, leaving reasoning tokens fully active.
2. **Provider-side only.** Even if honored, it suppresses reasoning on one specific provider/model. Any other provider that emits `reasoning_content` or `reasoning` fields will still trigger the bug.
3. **Root cause untouched.** The fix belongs in `renderChatMessage()` (`core/util/messageContent.ts:24`), where `role: "thinking"` must not be rendered as plain text in the diff pipeline context.
