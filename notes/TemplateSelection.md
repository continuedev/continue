# Prompt Template Selection for Chat-Endpoint Providers

This document covers template selection for providers that have a native chat endpoint — those listed in `PROVIDER_HANDLES_TEMPLATING` (`core/llm/autodetect.ts:46`), including `openai`, `anthropic`, `ollama`, `azure`, `gemini`, and others.

For these providers `autodetectPromptTemplates()` is never called, so `llm.promptTemplates.edit` and `llm.promptTemplates.apply` are always left unset. The fallback templates defined in `streamDiffLines.ts` are used instead.

---

## Edit template (Cmd+I)

**Always:** `gptEditPrompt` (`core/llm/templates/edit/gpt.ts`)

Returns a plain `string` containing prefix, the code to edit, suffix, and the user's instruction formatted as labeled prose in a single block. This string becomes the content of a single `user` message sent to `POST /v1/chat/completions`.

---

## Apply template (Apply button on chat code block)

**Always:** `defaultApplyPrompt` (`core/llm/templates/edit/gpt.ts:75`)

Returns a `ChatMessage[]` with:

- A `user` message containing `ORIGINAL CODE` (full file) and `SUGGESTED EDIT` (the code block from chat), with an instruction to output the complete modified file
- An `assistant` prefill of ` ``` ` to constrain the model to start its response with a code block

Used on the full-rewrite path when neither the deterministic nor the unified-diff strategy succeeded.

---

## Autocomplete template

Selected at call time by `getTemplateForModel(llm.model)` (`core/autocomplete/templating/AutocompleteTemplate.ts:517`) based on the model name. For the models typically used with chat-endpoint providers:

| Model name contains                                     | Template                        | What it generates                                                                                                         |
| ------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `gpt`, `davinci-002`, `claude`, `granite3`, `granite-3` | `holeFillerTemplate`            | Instruction prompt with prefix/suffix embedded as a `{{FILL_HERE}}` hole; multi-shot examples; stop token `</COMPLETION>` |
| `codestral`                                             | `codestralMultifileFimTemplate` | FIM prompt with multi-file context                                                                                        |
| `deepseek`                                              | `deepseekFimTemplate`           | FIM prompt                                                                                                                |
| (all others)                                            | `stableCodeFimTemplate`         | FIM prompt (fallback)                                                                                                     |

`holeFillerTemplate` is the relevant template for GPT and Claude models. The generated prompt instructs the model to fill in the hole between prefix and suffix and wrap the result in `<COMPLETION>...</COMPLETION>` tags. This single formatted string is sent as a `user` message to `POST /v1/chat/completions`.

---

## Lazy apply prompt

Selected at call time by `lazyApplyPromptForModel(llm.model, llm.providerName)` (`core/edit/lazy/prompts.ts:54`):

| Model name contains | Prompt                        | What it generates                                                                                                                                            |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sonnet`            | `claudeSonnetLazyApplyPrompt` | `user` message with `ORIGINAL CODE` + `NEW CODE`; model may write `UNCHANGED CODE` comments for unchanged sections; `assistant` prefill opens the code block |
| (all others)        | `undefined` → error thrown    | Not supported — falls back to `defaultApplyPrompt`                                                                                                           |

---

## Summary

| Feature                   | Template                      | Return type         | Selected                              |
| ------------------------- | ----------------------------- | ------------------- | ------------------------------------- |
| Edit (Cmd+I)              | `gptEditPrompt`               | `string`            | Always (fallback, autodetect skipped) |
| Apply — full rewrite      | `defaultApplyPrompt`          | `ChatMessage[]`     | Always (fallback, autodetect skipped) |
| Autocomplete — GPT/Claude | `holeFillerTemplate`          | `string` (function) | Model name contains `gpt` or `claude` |
| Autocomplete — FIM models | FIM-specific template         | `string`            | Model name match                      |
| Lazy apply — Sonnet       | `claudeSonnetLazyApplyPrompt` | `ChatMessage[]`     | Model name contains `sonnet`          |
| Lazy apply — others       | not supported                 | —                   | —                                     |

---

## Key source locations

| File                                                       | Relevance                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `core/llm/autodetect.ts:46`                                | `PROVIDER_HANDLES_TEMPLATING` — providers that skip autodetection  |
| `core/llm/templates/edit/gpt.ts`                           | `gptEditPrompt` (string), `defaultApplyPrompt` (ChatMessage[])     |
| `core/edit/streamDiffLines.ts:52`                          | Edit template lookup: `llm.promptTemplates?.edit ?? gptEditPrompt` |
| `core/autocomplete/templating/AutocompleteTemplate.ts:517` | `getTemplateForModel()` — autocomplete template selection          |
| `core/edit/lazy/prompts.ts:54`                             | `lazyApplyPromptForModel()` — lazy apply prompt selection          |
