# ILLM Interface: Which Methods Are Called and When

The `ILLM` interface (`core/index.d.ts:108`) exposes eight callable methods. The table below shows which feature calls which method and why.

---

## Method overview

| Method           | Signature                                                                     | Streaming? |
| ---------------- | ----------------------------------------------------------------------------- | ---------- |
| `streamChat`     | `(messages: ChatMessage[], signal, options?) → AsyncGenerator<ChatMessage>`   | Yes        |
| `streamComplete` | `(prompt: string, signal, options?) → AsyncGenerator<string>`                 | Yes        |
| `streamFim`      | `(prefix: string, suffix: string, signal, options?) → AsyncGenerator<string>` | Yes        |
| `chat`           | `(messages: ChatMessage[], signal, options?) → Promise<ChatMessage>`          | No         |
| `complete`       | `(prompt: string, signal, options?) → Promise<string>`                        | No         |
| `embed`          | `(chunks: string[]) → Promise<number[][]>`                                    | No         |
| `rerank`         | `(query: string, chunks: Chunk[]) → Promise<number[]>`                        | No         |
| `listModels`     | `() → Promise<string[]>`                                                      | No         |

---

## `streamChat`

Called whenever the caller has a `ChatMessage[]` array and wants a streaming response.

| Feature                                      | Source                                                                                                  | Notes                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat mode                                    | `core/llm/streamChat.ts:117`                                                                            | Always. Uses `selectedModelByRole.chat`. Messages built by `constructMessages()` in the GUI.                                                |
| Agent mode                                   | `core/llm/streamChat.ts:117`                                                                            | Same path as chat; tools array added to the request body.                                                                                   |
| Edit mode — rules/system message active      | `core/edit/recursiveStream.ts:80`                                                                       | Called when `streamDiffLines.ts` wraps the string prompt into `[system, user]` due to active `.continue/rules/` or `baseChatSystemMessage`. |
| Edit mode — template returns `ChatMessage[]` | `core/edit/recursiveStream.ts:80`                                                                       | Called when the edit template (e.g. `osModelsEditPrompt`, `claudeEditPrompt`) returns a message array directly.                             |
| Edit mode — lazy apply                       | `core/edit/lazy/replace.ts:84`, `core/edit/lazy/streamLazyApply.ts:27`                                  | Apply path for large files that uses a lazy-diff strategy.                                                                                  |
| Legacy slash commands                        | `core/commands/slash/built-in-legacy/review.ts:46`, `commit.ts:17`, `draftIssue.ts:47`, `onboard.ts:47` | Legacy `/review`, `/commit`, `/draftIssue`, `/onboard` commands.                                                                            |

---

## `streamComplete`

Called when the caller has a plain string prompt and wants a streaming response.

| Feature                             | Source                                                  | Notes                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit mode — string prompt, no rules | `core/edit/recursiveStream.ts:43`                       | Called when `gptEditPrompt` returns a string and no rules/system message are active. Options include `raw: true`, which skips prompt templating and (for non-chat-only models) would also trigger the legacy `/v1/completions` endpoint inside OpenAI's `_streamChat`. |
| Autocomplete — no FIM support       | `core/autocomplete/generation/CompletionStreamer.ts:36` | Fallback when `llm.supportsFim()` returns false. Also passes `raw: true`.                                                                                                                                                                                              |
| Legacy slash command `/cmd`         | `core/commands/slash/built-in-legacy/cmd.ts:22`         | Runs a shell command description through the LLM.                                                                                                                                                                                                                      |

---

## `streamFim`

Called for Fill-in-the-Middle autocomplete. Sends `prefix` and `suffix` as separate fields; the model fills in the gap.

| Feature                           | Source                                                  | Notes                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Autocomplete — FIM-capable models | `core/autocomplete/generation/CompletionStreamer.ts:35` | Called when `llm.supportsFim()` returns `true` (e.g. Deepseek, Ollama, Mistral FIM models). Sends `POST /v1/fim/completions` (non-standard). |

---

## `chat`

Non-streaming variant of `streamChat`. Used for internal one-shot queries where the full response is needed before proceeding.

| Feature                                     | Source                                                          | Notes                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Next-edit predictions                       | `core/nextEdit/NextEditProvider.ts:480`                         | Requests a next-edit suggestion with `stream: false` (Mercury Coder does not support streaming). |
| Codebase context retrieval — tool selection | `core/context/retrieval/pipelines/BaseRetrievalPipeline.ts:233` | Asks the LLM which retrieval tool to use for a given query.                                      |
| Codebase context retrieval — repo map       | `core/context/retrieval/repoMapRequest.ts:63`                   | Asks the LLM to select relevant files from a repo map for `@codebase` context.                   |

---

## `complete`

Non-streaming variant of `streamComplete`.

| Feature                            | Source                                                 | Notes                                                                  |
| ---------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Legacy slash command `/draftIssue` | `core/commands/slash/built-in-legacy/draftIssue.ts:32` | Generates a short issue title synchronously before streaming the body. |

---

## `embed`

Converts text chunks into embedding vectors. Used exclusively for indexing and semantic search.

| Feature           | Source                                            | Notes                                                                                                               |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Codebase indexing | `core/indexing/LanceDbIndex.ts:203, 451, 456`     | Embeds code chunks during indexing and embeds the search query at retrieval time. Uses `selectedModelByRole.embed`. |
| Docs indexing     | `core/indexing/docs/DocsService.ts:507, 634, 764` | Embeds documentation chunks and search queries for `@docs` context. Uses `selectedModelByRole.embed`.               |

---

## `rerank`

Re-scores a list of retrieved chunks by relevance to a query. Called after an initial vector/FTS retrieval to improve result quality.

| Feature                               | Source                                                              | Notes                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Codebase context retrieval            | `core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts:102` | Re-ranks chunks returned by the embedding pipeline. Uses `selectedModelByRole.rerank`. |
| Docs context provider                 | `core/context/providers/DocsContextProvider.ts:44`                  | Re-ranks doc chunks for `@docs` mentions.                                              |
| Next-edit editable region calculation | `core/nextEdit/NextEditEditableRegionCalculator.ts:207, 391`        | Selects which code regions are most relevant for a next-edit suggestion.               |

---

## `listModels`

Queries the provider for all available model names. Not used during normal inference.

| Feature                          | Source                                                           | Notes                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Config loading — model discovery | `core/config/load.ts:280, 317`, `core/config/yaml/models.ts:170` | Called when a config entry uses a wildcard/placeholder model name to discover what models the provider offers. |
| GUI model list request           | `core/core.ts:1406`                                              | Handles an explicit request from the GUI to list available models for a configured provider.                   |

---

## Role assignment summary

Each method is associated with a config role that determines which LLM instance is used:

| Method                                                          | Config role (`selectedModelByRole.*`)               |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `streamChat`, `streamComplete`, `streamFim`, `chat`, `complete` | `chat` (or `edit` / `autocomplete` for those modes) |
| `embed`                                                         | `embed`                                             |
| `rerank`                                                        | `rerank`                                            |
| `listModels`                                                    | whichever provider is being queried                 |

For **edit mode**, `selectedModelByRole.edit` is always `null` in YAML config; the tool falls back to `selectedModelByRole.chat`. For **autocomplete**, `selectedModelByRole.autocomplete` is used.

---

## Key source locations

| File                                                                | Relevance                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| `core/index.d.ts:108`                                               | `ILLM` interface definition                            |
| `core/llm/streamChat.ts:117`                                        | Chat and agent mode entry point                        |
| `core/edit/recursiveStream.ts:40`                                   | Edit mode dispatch: `streamComplete` vs `streamChat`   |
| `core/autocomplete/generation/CompletionStreamer.ts:34`             | Autocomplete dispatch: `streamFim` vs `streamComplete` |
| `core/nextEdit/NextEditProvider.ts:480`                             | Next-edit: `chat` with `stream: false`                 |
| `core/indexing/LanceDbIndex.ts:203`                                 | Codebase indexing: `embed`                             |
| `core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts:102` | Retrieval: `rerank`                                    |
| `core/config/load.ts:280`                                           | Config loading: `listModels`                           |
