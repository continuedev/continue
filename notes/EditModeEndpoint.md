# Edit Mode: How the API Endpoint Is Chosen

The decision between `POST /v1/chat/completions` and `POST /v1/completions` in edit mode is made across four sequential branch points.

---

## Branch 1: Template selection

`constructEditPrompt()` (`core/edit/streamDiffLines.ts:37`) picks the edit template:

```ts
const template = llm.promptTemplates?.edit ?? gptEditPrompt;
```

`promptTemplates.edit` is populated at LLM construction time by `autodetectPromptTemplates()` (`core/llm/autodetect.ts:473`), which maps model name to a template. For the **OpenAI provider**, `autodetectPromptTemplates()` is never called at all — `openai` is in the `PROVIDER_HANDLES_TEMPLATING` list (`autodetect.ts:46`), so `autodetectTemplateFunction()` returns `null` early and `promptTemplates.edit` is left unset. The fallback `gptEditPrompt` is therefore always used.

**`gptEditPrompt` always returns a plain `string`** — it formats prefix, code-to-edit, suffix, and user instruction into a single text block.

For non-OpenAI models the template may differ:

| Template                                        | Return type                                       | Used for                                        |
| ----------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| `gptEditPrompt`                                 | `string`                                          | OpenAI (fallback for any unrecognized provider) |
| `osModelsEditPrompt`                            | `ChatMessage[]` with trailing `assistant` prefill | Llama, Mistral, DeepSeek, Gemma, etc.           |
| `claudeEditPrompt`                              | `ChatMessage[]` with trailing `assistant` prefill | Anthropic template type                         |
| `simplifiedEditPrompt`                          | `string` (Handlebars template)                    | phi2                                            |
| Other legacy prompts (`zephyr`, `alpaca`, etc.) | `string` (Handlebars templates)                   | Specific older models                           |

---

## Branch 2: `renderPromptTemplate` may collapse a `ChatMessage[]` back to a string

`renderPromptTemplate()` (`core/llm/index.ts:1486`) is always called with `canPutWordsInModelsMouth = false` (the default; `streamDiffLines.ts` never passes it as `true`).

```ts
if (
  typeof rendered !== "string" &&
  rendered[rendered.length - 1]?.role === "assistant" &&
  !canPutWordsInModelsMouth          // always true here
) {
  const templateMessages = autodetectTemplateFunction(...);
  if (templateMessages) {
    return templateMessages(rendered); // collapsed back to string
  }
}
```

If the template returned a `ChatMessage[]` ending with an `assistant` message (a prefill), and `autodetectTemplateFunction()` returns a non-null formatter, the message array is collapsed into a raw string and the path ends up calling `streamComplete` → `/v1/completions`.

For **OpenAI provider** this collapse never fires because `autodetectTemplateFunction()` returns `null` for it (same `PROVIDER_HANDLES_TEMPLATING` check). The `ChatMessage[]` from e.g. `claudeEditPrompt` would stay as-is for Anthropic too, because Anthropic is also in that list.

For models served via **Ollama / local runners** with a recognised template type (llama2, chatml, etc.), `autodetectTemplateFunction()` returns a formatter, so their `ChatMessage[]` is collapsed to a formatted string → `/v1/completions`.

---

## Branch 3: Active rules can force a string into `ChatMessage[]`

Back in `streamDiffLines.ts:117–158`. After the prompt is constructed, if either condition holds:

- `rulesToInclude` (rules from `.continue/rules/*.md`) has any entries, **or**
- `llm.baseChatSystemMessage` is set

…a system message string is computed via `getSystemMessageWithRules()`. If that string is non-empty:

- **String prompt** → wrapped into `[{ role: "system", … }, { role: "user", … }]` — now a `ChatMessage[]`
- **Existing `ChatMessage[]`** → system message prepended (or merged with existing system entry)

**This is the only mechanism that can redirect an OpenAI edit request from `/v1/completions` to `/v1/chat/completions`.**

---

## Branch 4: `recursiveStream` dispatches on `typeof prompt`

`core/edit/recursiveStream.ts:40`:

```ts
if (typeof prompt === "string") {
  llm.streamComplete(prompt, ...)   // → POST /v1/completions
} else {
  llm.streamChat(messages, ...)     // → POST /v1/chat/completions
}
```

This is the final, unconditional branch. There is no other logic here.

---

## Complete decision tree (OpenAI provider)

```
Edit triggered (Cmd+I)
        │
        ▼
Template: gptEditPrompt  →  string
        │
        ▼
renderPromptTemplate()   →  still a string
(PROVIDER_HANDLES_TEMPLATING: no collapse attempted)
        │
        ├── baseChatSystemMessage set?  ──┐
        │   OR                           │
        └── active .continue/rules?  ────┤
                                         │
                      YES ───────────────┤
                       │                 │
                       ▼                 │
                [system, user]           │
                (ChatMessage[])          │
                       │                 │
                       ▼                 │
              streamChat()               │
              POST /v1/chat/completions  │
                                         │
                      NO ────────────────┘
                       │
                       ▼
              streamComplete()
              POST /v1/completions
```

**Summary: with a plain OpenAI model and no rules configured, edit mode uses `/v1/completions`. Adding any `.continue/rules/*.md` file or setting `baseChatSystemMessage` in `config.yaml` switches it to `/v1/chat/completions`.**

---

## Key source locations

| File                              | Relevance                                                                  |
| --------------------------------- | -------------------------------------------------------------------------- |
| `core/edit/streamDiffLines.ts:37` | Template selection and rules-driven string→ChatMessage[] conversion        |
| `core/edit/recursiveStream.ts:40` | Final `typeof prompt` dispatch: `streamComplete` vs `streamChat`           |
| `core/llm/index.ts:1486`          | `renderPromptTemplate()` — optional collapse of ChatMessage[] to string    |
| `core/llm/autodetect.ts:46`       | `PROVIDER_HANDLES_TEMPLATING` — providers that skip template autodetection |
| `core/llm/autodetect.ts:456`      | `USES_OS_MODELS_EDIT_PROMPT` — model types that use `osModelsEditPrompt`   |
| `core/llm/autodetect.ts:473`      | `autodetectPromptTemplates()` — maps model/template-type to edit template  |
| `core/llm/templates/edit/gpt.ts`  | `gptEditPrompt` (string) and `defaultApplyPrompt` (ChatMessage[])          |
| `core/llm/templates/edit.ts`      | `osModelsEditPrompt` and all other legacy edit templates                   |
