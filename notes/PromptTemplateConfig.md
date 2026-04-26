# Configuring Custom Prompt Templates

Users can override the built-in prompt templates for `edit`, `apply`, and `autocomplete` by adding a `promptTemplates` block to any model entry in `config.yaml`. Templates are Handlebars strings with `{{placeholder}}` syntax.

**Schema source:** `packages/config-yaml/src/schemas/models.ts:170`

---

## Config structure

```yaml
models:
  - provider: openai
    model: gpt-4o
    promptTemplates:
      edit: |
        Rewrite the following {{language}} code as requested.
        Code: {{codeToEdit}}
        Request: {{userInput}}
        Rewritten code:
      apply: |
        ORIGINAL:
        {{original_code}}
        EDIT:
        {{new_code}}
        Apply the edit. Output the complete file only.
      autocomplete: "{{prefix}}<FILL>{{suffix}}"
```

---

## Key: `edit`

**Type:** Handlebars string  
**Replaces:** `gptEditPrompt` (the default for providers with a chat endpoint)  
**Used by:** Cmd+I inline edit

### Available placeholders

| Placeholder          | Content                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| `{{prefix}}`         | Text in the file above the selected region                                    |
| `{{codeToEdit}}`     | The selected code to be rewritten                                             |
| `{{suffix}}`         | Text in the file below the selected region                                    |
| `{{userInput}}`      | The user's instruction entered in the Cmd+I bar                               |
| `{{language}}`       | File language identifier (e.g. `typescript`)                                  |
| `{{history}}`        | Array of prior chat messages (always `[]` for edit mode — not useful here)    |
| `{{system_message}}` | Content of the first message if it had `role: system` (always empty for edit) |

The rendered string is sent as a single `user` message to the chat endpoint.

**Note:** Unlike `gptEditPrompt`, a custom string template has no conditional dispatch logic — the same template is used regardless of whether `prefix`/`suffix` are empty. Use Handlebars `{{#if prefix}}...{{/if}}` blocks for conditional sections.

---

## Key: `apply`

**Type:** Handlebars string  
**Replaces:** `defaultApplyPrompt`  
**Used by:** Apply button on a chat code block (LLM full-rewrite path)

### Available placeholders

| Placeholder          | Content                                                 |
| -------------------- | ------------------------------------------------------- |
| `{{original_code}}`  | Full content of the file before the edit                |
| `{{new_code}}`       | The code block from the chat suggestion                 |
| `{{history}}`        | Array of prior messages (always `[]` — not useful here) |
| `{{system_message}}` | Content of a leading system message (always empty here) |

**Important:** `defaultApplyPrompt` returns a `ChatMessage[]` with an assistant prefill of ` ``` ` to constrain the model's response. A user-supplied string template cannot produce a prefill, so the assistant is not pre-seeded with a code block opener. If the model tends to add prose before the code, prefer the default.

---

## Key: `autocomplete`

**Type:** Handlebars string  
**Replaces:** the built-in template selected by `getTemplateForModel()` (e.g. `holeFillerTemplate` for GPT/Claude)  
**Used by:** Tab autocomplete

### Available placeholders

| Placeholder    | Content                             |
| -------------- | ----------------------------------- |
| `{{prefix}}`   | Code before the cursor              |
| `{{suffix}}`   | Code after the cursor               |
| `{{filename}}` | Basename of the current file        |
| `{{reponame}}` | Basename of the workspace directory |
| `{{language}}` | Language name                       |

**Note:** The autocomplete template is rendered differently from edit/apply — it goes through `renderStringTemplate()` (`core/autocomplete/templating/index.ts:37`) rather than `renderPromptTemplate()`. It receives no `history` or `system_message`.

---

## Key: `chat`

**Type:** enum (not a Handlebars string)  
**Purpose:** Selects the message formatter — the function that converts a `ChatMessage[]` array to a raw string for models that do not have a native chat endpoint (e.g. local Ollama models without chat support).

Valid values: `llama2`, `alpaca`, `zephyr`, `phi2`, `phind`, `anthropic`, `chatml`, `none`, `openchat`, `deepseek`, `xwin-coder`, `neural-chat`, `codellama-70b`, `llava`, `gemma`, `granite`, `llama3`, `codestral`

This key is unrelated to the Handlebars template mechanism — it does not support custom strings or placeholders.

---

## How the template is applied

`renderPromptTemplate()` (`core/llm/index.ts:1486`) handles string templates:

1. Builds a data object from `history` + `otherData`.
2. If the first message in `history` has `role: system`, moves its content to `data.system_message`.
3. Compiles the Handlebars template and renders it with that data.
4. Returns the rendered string, which is then sent to the LLM.

User-supplied templates in `promptTemplates` take precedence over autodetected ones because the config merge is:

```ts
this.promptTemplates = {
  ...autodetectPromptTemplates(options.model, templateType),
  ...options.promptTemplates, // user config wins
};
```

---

## Key source locations

| File                                             | Relevance                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/config-yaml/src/schemas/models.ts:170` | `promptTemplatesSchema` — defines the four valid keys and their types      |
| `core/llm/index.ts:257`                          | Merge of autodetected and user-supplied templates at LLM construction      |
| `core/llm/index.ts:1486`                         | `renderPromptTemplate()` — Handlebars rendering for string templates       |
| `core/edit/streamDiffLines.ts:37`                | `llm.promptTemplates?.edit ?? gptEditPrompt` — edit template lookup        |
| `core/edit/streamDiffLines.ts:52`                | `llm.promptTemplates?.apply ?? defaultApplyPrompt` — apply template lookup |
| `core/autocomplete/CompletionProvider.ts:185`    | `llm.promptTemplates?.autocomplete` → passed as `options.template`         |
| `core/autocomplete/templating/index.ts:37`       | `renderStringTemplate()` — Handlebars rendering for autocomplete           |
