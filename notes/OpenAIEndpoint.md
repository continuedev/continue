# Which OpenAI API Endpoints Does Continue Use?

Continue uses different OpenAI API endpoints depending on the mode.

## Chat mode → `POST /v1/chat/completions`

Always. The `llmStreamChat` function (`core/llm/streamChat.ts`) calls `model.streamChat(messages, ...)`, which hits `POST chat/completions` with a full `messages[]` array.

## Agent mode → `POST /v1/chat/completions` (with `tools`)

Same endpoint as chat. Agent mode is chat with tool-calling enabled — the same `streamChat` path, just with tool definitions added to the request body.

## Edit mode (inline edit / Cmd+I) → depends on the prompt template

Edit mode calls `streamDiffLines` (`core/edit/streamDiffLines.ts`), which delegates to `recursiveStream` (`core/edit/recursiveStream.ts`). Inside `recursiveStream`:

- If the edit prompt resolves to a **`ChatMessage[]` array** (the case for all modern/GPT/o-series models) → calls `llm.streamChat(...)` → **`POST /v1/chat/completions`**
- If the edit prompt resolves to a **plain `string`** (legacy path) → calls `llm.streamComplete(...)` → **`POST /v1/completions`**

The choice of template is made in `core/llm/templates/edit.ts`. `gptEditPrompt` returns a `ChatMessage[]`; `simplifiedEditPrompt` returns a string. For standard OpenAI GPT/o-series models the chat path is always taken.

## Autocomplete (tab completion)

This is a separate mode from the three above. In `core/autocomplete/generation/CompletionStreamer.ts`:

- If `llm.supportsFim()` → calls `llm.streamFim(prefix, suffix, ...)` → **`POST /v1/fim/completions`** (non-standard; supported by Deepseek, Ollama, Mistral, etc.)
- If `!supportsFim()` → falls back to `llm.streamComplete(prompt, ...)` → **`POST /v1/completions`**

The standard OpenAI provider does not override `supportsFim()` (base class returns `false`), so autocomplete via OpenAI always uses **`POST /v1/completions`**.

## Summary

| Mode                                              | OpenAI API endpoint                     |
| ------------------------------------------------- | --------------------------------------- |
| Chat                                              | `POST /v1/chat/completions`             |
| Agent                                             | `POST /v1/chat/completions` (+ `tools`) |
| Edit (modern models)                              | `POST /v1/chat/completions`             |
| Edit (legacy/string prompt)                       | `POST /v1/completions`                  |
| Autocomplete (OpenAI)                             | `POST /v1/completions`                  |
| Autocomplete (FIM-capable, e.g. Deepseek, Ollama) | `POST /v1/fim/completions`              |

## Key source locations

| File                                                 | Relevance                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `core/llm/llms/OpenAI.ts`                            | `_streamChat` (chat/completions), `_legacystreamComplete` (completions), `_streamFim` (fim/completions) |
| `core/llm/index.ts`                                  | `supportsCompletions()`, `supportsFim()` base implementations                                           |
| `core/llm/streamChat.ts`                             | Entry point for chat and agent mode                                                                     |
| `core/edit/streamDiffLines.ts`                       | Edit mode prompt construction and routing                                                               |
| `core/edit/recursiveStream.ts`                       | Decides `streamChat` vs `streamComplete` based on prompt type                                           |
| `core/autocomplete/generation/CompletionStreamer.ts` | Decides `streamFim` vs `streamComplete` for autocomplete                                                |
| `core/llm/templates/edit.ts`                         | Edit prompt templates (`gptEditPrompt`, `osModelsEditPrompt`, etc.)                                     |
