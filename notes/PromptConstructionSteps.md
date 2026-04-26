# Prompt Construction Steps

This document describes how the input to the LLM is constructed and transformed as it travels from the feature layer (chat, edit, apply, autocomplete) down to the actual HTTP call. There are three kinds of templates involved, applied at different stages.

---

## Three kinds of templates

### 1. Chat message templates

Build the `ChatMessage[]` array that is passed to `llm.streamChat()`. These produce structured message lists with roles (`system`, `user`, `assistant`, `tool`). Examples: `constructMessages()` for chat/agent/plan mode, `defaultApplyPrompt` for apply mode. Covered in `ChatMessageTemplates.md`.

### 2. Complete templates

Build the plain string that is passed to `llm.streamComplete()`. These are `PromptTemplateFunction`s (or Handlebars strings) that take `otherData` (prefix, suffix, userInput, etc.) and return a string. Examples: `gptEditPrompt` for edit mode, `holeFillerTemplate` for autocomplete. Covered in `PromptTemplateConfig.md` and `gptEditPrompt.md`.

### 3. Chat templates (message formatters)

Convert a `ChatMessage[]` array to a single formatted string for LLM backends that have no native chat API and expect a raw completion prompt (e.g. a local Llama2 model). Examples: `llama2TemplateMessages`, `chatmlTemplateMessages`. These are selected by `autodetectTemplateFunction()` based on model/provider name, and are only set for providers NOT in `PROVIDER_HANDLES_TEMPLATING`.

---

## Step 1 — Feature layer builds the input and calls streamComplete or streamChat

Each feature builds its input using a complete template or a chat message template and dispatches it:

| Feature                              | Input type                                        | Dispatch                            |
| ------------------------------------ | ------------------------------------------------- | ----------------------------------- |
| Chat / Agent / Plan                  | `ChatMessage[]` via `constructMessages()`         | `streamChat()`                      |
| Edit (no rules)                      | `string` via `gptEditPrompt`                      | `streamComplete()`                  |
| Edit (rules / system message active) | `ChatMessage[]` (string promoted)                 | `streamChat()`                      |
| Apply                                | `ChatMessage[]` via `defaultApplyPrompt`          | `streamChat()`                      |
| Lazy apply                           | `ChatMessage[]` via `claudeSonnetLazyApplyPrompt` | `streamChat()`                      |
| Autocomplete                         | `string` via `holeFillerTemplate` or FIM template | `streamComplete()` or `streamFim()` |

---

## Step 2 — Public BaseLLM methods preprocess and dispatch to provider methods

### `streamComplete(prompt, signal, options)`

**Source:** `core/llm/index.ts:724`

1. If `options.raw` is false AND `this.templateMessages` is set:
   `_templatePromptLikeMessages(prompt)` is called. This wraps the string into `[{role:"user", content: prompt}]`, applies the message formatter to it, and returns a **formatted string** (not a ChatMessage[]). The wrapping is transient — the output is still a string.
   If `this.templateMessages` is NOT set, the prompt is returned unchanged.

2. Calls `this._streamComplete(prompt, signal, options)` with the result.

### `streamChat(messages, signal, options)`

**Source:** `core/llm/index.ts` (around line 1170)

Branches on whether `this.templateMessages` is set:

- **`templateMessages` IS set** (non-chat-API provider):
  Converts the `ChatMessage[]` to a string by calling `this.templateMessages(messages)`, then calls `this._streamComplete(formattedString, signal, options)`.

- **`templateMessages` is NOT set** (native chat-API provider):
  Calls `this._streamChat(messages, signal, options)` directly.

### Who has `templateMessages` set?

Set in the `BaseLLM` constructor (`core/llm/index.ts:261`):

```ts
this.templateMessages =
  options.templateMessages ??
  autodetectTemplateFunction(model, providerName, options.template) ??
  undefined;
```

`autodetectTemplateFunction()` returns `null` immediately for any provider in `PROVIDER_HANDLES_TEMPLATING` (openai, anthropic, ollama, azure, gemini, and others). For all other providers it returns a formatter function selected by model name (llama2, chatml, alpaca, etc.) or the explicit `template:` config value.

---

## Step 3 — Provider methods route to the actual HTTP call

### `_streamComplete()` (protected, provider override)

The string arrives here either from `streamComplete()` or (for non-chat providers) from `streamChat()` after message formatting.

| Provider                                            | What `_streamComplete()` does                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| OpenAI, Anthropic, Gemini, Bedrock, and most others | Wraps string in `[{role:"user", content: prompt}]`, calls `_streamChat()` |
| Ollama                                              | Sends string directly to `POST /api/generate` — **terminal step**         |
| OpenAI legacy path                                  | `_streamChat()` gate may divert to `POST /v1/completions` (see below)     |

### `_streamChat()` (protected, provider override)

Receives a `ChatMessage[]` (either from `streamChat()` for native chat providers, or from `_streamComplete()` for most providers). Makes the actual HTTP call.

| Provider                              | HTTP endpoint                                        |
| ------------------------------------- | ---------------------------------------------------- |
| OpenAI (standard GPT models)          | `POST /v1/chat/completions`                          |
| OpenAI (legacy non-chat models, rare) | `POST /v1/completions` via `_legacyStreamComplete()` |
| Anthropic                             | Anthropic Messages API                               |
| Gemini / VertexAI                     | Google Generative Language API                       |
| Ollama                                | `POST /api/chat`                                     |
| Others                                | Provider-specific chat endpoint                      |

The OpenAI legacy gate in `_streamChat()` fires only when all of these are true: `!isChatOnlyModel(options.model)` AND `this.supportsCompletions()` AND one of `NON_CHAT_MODELS`, `useLegacyCompletionsEndpoint`, or `options.raw`. In practice unreachable for current GPT models.

### `BaseLLM._streamChat()` (default fallback, no provider override)

**Source:** `core/llm/index.ts:1436`

Used by providers that have `templateMessages` set but don't override `_streamChat()`. Applies `this.templateMessages(messages)` to get a string and calls `_streamComplete()`. This path is only reachable if `_streamComplete()` somehow calls `_streamChat()`, which does not happen for providers with `templateMessages` — so this serves as a safety net.

---

## The two string-wrapping sites

A prompt string can be wrapped into `[{role:"user", content: prompt}]` at two points:

1. **`_templatePromptLikeMessages()`** inside `streamComplete()` — only when `templateMessages` IS set. Immediately re-formats the ChatMessage[] back to a string. Used so the message formatter can incorporate the user message into the model-specific prompt format.

2. **`_streamComplete()`** (provider override) — only when `templateMessages` is NOT set. Produces a ChatMessage[] that is forwarded to `_streamChat()` for the chat API.

These two sites are on mutually exclusive paths. The `templateMessages` flag is the switch:

```
templateMessages set     → wrapping in _templatePromptLikeMessages() → string → _streamComplete() → API
templateMessages not set → wrapping in _streamComplete()             → ChatMessage[] → _streamChat() → API
```

---

## Full flow diagrams

### streamComplete() call (e.g. edit mode, no rules)

```
gptEditPrompt → string
  └─ streamComplete(string, raw=true)
       └─ raw=true: skip _templatePromptLikeMessages
       └─ _streamComplete(string)                        [provider override]
            └─ [{role:"user", content: string}]
            └─ _streamChat(messages)                     [provider override]
                 └─ POST /v1/chat/completions
```

### streamChat() call, no templateMessages (e.g. chat mode, OpenAI)

```
constructMessages() → ChatMessage[]
  └─ streamChat(messages)
       └─ no templateMessages → _streamChat(messages)   [provider override]
            └─ POST /v1/chat/completions
```

### streamChat() call, templateMessages set (e.g. local Llama2 model)

```
constructMessages() → ChatMessage[]
  └─ streamChat(messages)
       └─ templateMessages set → llama2TemplateMessages(messages) → string
       └─ _streamComplete(string)                        [provider override]
            └─ POST <raw completion endpoint>
```

---

## Key source locations

| File                          | Relevance                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `core/llm/index.ts:261`       | `this.templateMessages` assignment in BaseLLM constructor                           |
| `core/llm/index.ts:340`       | `_templatePromptLikeMessages()` — transient wrap + format in streamComplete         |
| `core/llm/index.ts:724`       | `streamComplete()` — raw flag, \_templatePromptLikeMessages, calls \_streamComplete |
| `core/llm/index.ts:1170`      | `streamChat()` — templateMessages branch → \_streamComplete or \_streamChat         |
| `core/llm/index.ts:1436`      | `BaseLLM._streamChat()` — fallback using templateMessages                           |
| `core/llm/autodetect.ts:411`  | `autodetectTemplateFunction()` — returns null for PROVIDER_HANDLES_TEMPLATING       |
| `core/llm/autodetect.ts:46`   | `PROVIDER_HANDLES_TEMPLATING` list                                                  |
| `core/llm/llms/OpenAI.ts:423` | `_streamComplete()` — wraps string → \_streamChat                                   |
| `core/llm/llms/OpenAI.ts:515` | `_streamChat()` — chat vs legacy completions gate                                   |
| `core/llm/llms/Ollama.ts:417` | `_streamComplete()` — sends raw string to /api/generate                             |
