# `streamComplete()` Routing: Chat Endpoint vs Raw String

When `llm.streamComplete(prompt, signal, options)` is called, the prompt string must eventually reach the LLM over HTTP. How that happens depends on the provider. There are three distinct patterns.

---

## When is `llm.streamComplete()` called?

There are three call sites in the codebase:

| Call site                                               | `raw`             | Trigger                                                                                                                                           |
| ------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/edit/recursiveStream.ts:43`                       | `true`            | Apply/edit when prompt is a string — i.e. a Handlebars `apply` or `edit` template is configured, or the string path is taken in `streamDiffLines` |
| `core/autocomplete/generation/CompletionStreamer.ts:36` | `true`            | Autocomplete fallback when the model does not support FIM (`llm.supportsFim()` returns `false`)                                                   |
| `core/commands/slash/built-in-legacy/cmd.ts:22`         | `false` (omitted) | Legacy `/cmd` slash command that generates a shell command                                                                                        |

The `defaultApplyPrompt` (used when no custom `apply` template is configured) returns `ChatMessage[]`, so it goes through `llm.streamChat()` instead and never reaches `streamComplete()`.

---

## Effect of `raw` on prompt templating

Before `_streamComplete()` is called, `streamComplete()` optionally applies `_templatePromptLikeMessages()`:

```ts
if (!raw) {
  prompt = this._templatePromptLikeMessages(prompt);
}
```

- **`raw: true`** — skips this step. The string reaches `_streamComplete()` unmodified.
- **`raw: false`** — wraps the string in a single `user` message and applies `templateMessages` if set, formatting it for the model's chat template. Also prevents the legacy completions gate from firing in `OpenAI._streamChat` (see Pattern 2).

---

## Pattern 1 — Always wraps in a user message → chat endpoint

**Providers:** Anthropic, Gemini, VertexAI, Bedrock, HuggingFaceTGI, Cohere, Together, Replicate, and most others that extend `BaseLLM` directly.

Their `_streamComplete()` implementation is identical in structure:

```ts
const messages = [{ role: "user", content: prompt }];
for await (const update of this._streamChat(messages, signal, options)) {
  yield renderChatMessage(update);
}
```

The prompt is wrapped in a single `user` message and forwarded to `_streamChat()`, which calls the provider's native chat endpoint. There is no legacy raw-string path. The `raw: true` option has no effect on endpoint selection here — it only controls prompt templating at the `BaseLLM.streamComplete()` level before `_streamComplete()` is called.

---

## Pattern 2 — OpenAI gate: chat endpoint OR legacy `/v1/completions`

**Providers:** `OpenAI`, `Azure`, and all other providers that extend `OpenAI` without overriding `_streamComplete()`.

`OpenAI._streamComplete()` wraps the prompt in a user message and calls `_streamChat()` — same as Pattern 1 — but `OpenAI._streamChat()` has a gate at the top that can divert to the legacy `POST /v1/completions` endpoint:

```ts
if (
  !isChatOnlyModel(options.model) &&      // model name doesn't start with "gpt" or "o"
  this.supportsCompletions() &&            // provider is openai/azure and apiBase is not Groq/Mistral/etc.
  (NON_CHAT_MODELS.includes(options.model) ||
   this.useLegacyCompletionsEndpoint ||
   options.raw)
)
```

If all conditions are true, `_legacystreamComplete()` is called, which sends the prompt as a raw string to `POST /v1/completions`. Otherwise the chat endpoint is used.

### When the gate fires

The gate is controlled by `options.raw`. Since `recursiveStream` and `CompletionStreamer` both pass `raw: true`, the gate fires whenever:

- The model name does **not** start with `gpt` or `o` — meaning `isChatOnlyModel()` returns `false`
- `supportsCompletions()` returns `true` — i.e. the provider is a generic OpenAI-compatible one not explicitly excluded

**For OpenAI's own models** (`gpt-4o`, `o3`, etc.) this is indeed unreachable: `isChatOnlyModel()` returns `true` and the gate never fires regardless of `raw`.

**For unknown models on OpenAI-compatible providers** (e.g. `qwen2.5-coder`, `gemma3`, any local model served via LM Studio, vLLM, or similar): the gate fires. The prompt reaches the model as a raw string via `POST /v1/completions`. This is problematic for instruction-tuned models that expect chat template tokens, and may fail entirely on inference servers that do not expose a completions endpoint.

**For `cmd.ts`** (`raw: false`): `options.raw` is `false`, so the gate never fires regardless of model name. The chat endpoint is always used.

`supportsCompletions()` itself returns `false` for Groq, Mistral, DeepSeek, and OpenAI-compatible providers pointing at specific known API bases (Groq, Mistral, NVIDIA, Jan), which prevents the gate from firing for those providers.

---

## Pattern 3 — Own raw generate endpoint (Ollama)

**Provider:** Ollama only.

Ollama's `_streamComplete()` does **not** delegate to `_streamChat()`. Instead it sends the prompt string directly to Ollama's own generation API:

```
POST /api/generate
Body: { prompt: "...", model: "...", ... }
```

This is Ollama's non-chat endpoint, separate from its chat endpoint (`/api/chat`). The prompt reaches the model as a raw string, not wrapped in a message array. This path is always used for `streamComplete()` on Ollama regardless of any options.

---

## Summary

| Provider                                | `raw`   | `streamComplete()` sends prompt as | HTTP endpoint                        |
| --------------------------------------- | ------- | ---------------------------------- | ------------------------------------ |
| Anthropic, Gemini, Bedrock, most others | any     | Single `user` message              | Provider's native chat endpoint      |
| OpenAI / Azure — `gpt-*` / `o-*` models | any     | Single `user` message              | `POST /v1/chat/completions`          |
| OpenAI-compatible — unknown model name  | `true`  | Raw string                         | `POST /v1/completions` (problematic) |
| OpenAI-compatible — unknown model name  | `false` | Single `user` message              | `POST /v1/chat/completions`          |
| Ollama                                  | any     | Raw string                         | `POST /api/generate`                 |

---

## Key source locations

| File                                                    | Relevance                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `core/llm/llms/OpenAI.ts:423`                           | `_streamComplete()` — wraps in user message, delegates to `_streamChat()`   |
| `core/llm/llms/OpenAI.ts:515`                           | `_streamChat()` — gate selecting chat vs legacy completions endpoint        |
| `core/llm/llms/OpenAI.ts:488`                           | `_legacystreamComplete()` — sends raw string to `POST /v1/completions`      |
| `core/llm/index.ts:126`                                 | `supportsCompletions()` — which providers/bases support the legacy endpoint |
| `core/llm/llms/Ollama.ts:417`                           | `_streamComplete()` — sends raw string to `POST /api/generate`              |
| `core/llm/llms/Anthropic.ts:254`                        | `_streamComplete()` — wraps in user message, no legacy path                 |
| `core/llm/llms/Gemini.ts:82`                            | `_streamComplete()` — wraps in user message, no legacy path                 |
| `core/edit/recursiveStream.ts:40`                       | calls `streamComplete` with `raw: true` (string prompt path)                |
| `core/autocomplete/generation/CompletionStreamer.ts:36` | calls `streamComplete` with `raw: true` (non-FIM autocomplete fallback)     |
| `core/commands/slash/built-in-legacy/cmd.ts:22`         | calls `streamComplete` without `raw` (defaults to `false`)                  |
