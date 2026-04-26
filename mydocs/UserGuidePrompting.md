# Continue Prompting: A Guide for Advanced Users

This guide explains how Continue constructs the prompts it sends to LLMs, what configuration knobs are available, and how they interact. It is aimed at users who want to understand and fine-tune the prompting process rather than just use the defaults.

---

## 1. Two LLM APIs: Chat vs. Raw Completion

LLM providers typically expose two distinct API styles, and Continue can use both.

### Chat API

The chat API (e.g. `POST /v1/chat/completions`) accepts a structured list of messages, each with a `role` field:

- `system` — instructions that frame the model's behaviour
- `user` — the human turn
- `assistant` — the model's prior responses
- `tool` — outputs from tool calls (agent mode only)

The provider handles all the model-specific formatting of this list internally. This is the primary API used by Continue for all modern hosted providers: OpenAI, Anthropic, Azure, Gemini, and others.

### Raw Completion API

The raw completion API (e.g. `POST /v1/completions`) accepts a single prompt string and returns a completion. The client is responsible for any formatting. Some locally-hosted or specialised coding models — particularly older or smaller models designed specifically for code completion tasks — expose only this API. Continue supports this path as well.

### Which path does Continue take?

This depends on two things: the feature triggering the request, and the model configured for that feature.

**Feature matters:** chat, plan, agent, and apply always produce a structured message list regardless of model. Edit and autocomplete always produce a plain prompt string. See section 2 for detail on each feature.

**Model matters:** if the model for a given feature has a native chat API, message lists are sent directly to the chat endpoint and prompt strings are wrapped in a single user message before being sent. If the model exposes only a raw completion endpoint, prompt strings are sent as-is, and message lists are first formatted into a single string using the model's expected conversation format. See section 3 for how models are assigned to features, and section 3's "Using models without a chat API" for how the formatting works.

### Why does this matter for configuration?

A common advanced setup is to use a powerful chat model for conversations while routing simpler, cost-effective tasks — autocomplete, inline editing, code application — to a specialised coding model. That coding model might expose only a raw completion API. Continue's model role system (section 3) makes this straightforward to configure.

---

## 2. Prompting by Feature

Different Continue features construct their LLM input differently. Understanding what each feature sends helps you tune it effectively and choose the right model for each task.

### 2.1 Chat, Plan, and Agent mode

In these three modes, Continue sends a full conversation history to the chat API each time you submit a message. The message list has this structure:

```
[system message]
[user message (context items + your text)]
[assistant response]
[user message]
...
[user message (context items + your text)]   ← current turn
```

**System message** — a single `system` role message prepended to the conversation. It contains:

1. A built-in base message appropriate for the mode (see section 5.1).
2. Any applicable rules from your `.continue/rules/` directory (see section 6).
3. Optionally a summary of earlier conversation turns if the history was auto-compressed.

**User messages** — each user message is multipart: any context items you attached (via `@`-mentions or automatic inclusion) are prepended as plain text blocks, followed by your typed message. The LLM sees the context inline, not in a separate channel.

**Agent mode** additionally includes `tool` messages representing the outputs of tool calls between assistant turns.

**Model used:** the chat model currently selected in the Continue panel. This always uses the chat API.

### 2.2 Inline Edit (Cmd+I)

When you trigger an inline edit, Continue selects a portion of your file (or the cursor position if nothing is selected) and sends a prompt to the model. No conversation history is included.

The prompt is constructed from three parts of the file — the text before the selection (_prefix_), the selected code (_code to edit_), and the text after (_suffix_) — along with your instruction. How these are combined depends on what is selected:

- **Cursor only (nothing selected):** the prompt shows the full context around the cursor with a `[BLANK]` marker and asks the model to fill it in without repeating the surrounding code.
- **Entire file selected (no prefix or suffix):** the prompt shows the full file and asks for a complete rewrite.
- **Partial selection (the common case):** the prompt presents the prefix, suffix, and selected code as labeled sections, and asks the model to rewrite only the selected section.

If any rules are active (see section 6) or a base system message is configured, a `system` message is prepended and the whole thing is sent as a two-message chat.

The model's response is streamed back and diffed against the original selection to produce the inline diff view.

**Model used:** the model assigned to the `edit` role, falling back to the active chat model if no edit-specific model is configured (see section 3).

### 2.3 Autocomplete (Tab)

Autocomplete sends a prompt constructed from the code before and after the cursor. For GPT and Claude variants, this is an instruction-style prompt that asks the model to fill in the gap, with the result wrapped in `<COMPLETION>...</COMPLETION>` tags and multi-shot examples to guide the format.

For models whose names contain `codestral` or `deepseek`, a Fill-in-the-Middle (FIM) format is used instead, passing prefix and suffix as separate fields to a dedicated FIM endpoint — a format natively supported by those models and often more efficient.

Unlike chat mode, autocomplete does not include a system message or conversation history — each completion is a standalone prompt.

**Model used:** the model assigned to the `autocomplete` role. Autocomplete will not run if no autocomplete model is configured. This is intentional — the autocomplete model is typically a smaller, faster, and cheaper model than the chat model, and must be explicitly designated.

### 2.4 Apply (Apply button on a chat code block)

When you click Apply on a code block in the chat panel, Continue attempts to integrate the suggestion into your file using a three-step strategy:

1. **Deterministic** — tree-sitter based structural matching. No LLM involved.
2. **Unified diff** — the suggestion is treated as a unified diff patch. No LLM involved.
3. **LLM full rewrite** — if both of the above fail, the LLM is called with a two-message prompt:

````
user:      ORIGINAL CODE: <full file content>
           SUGGESTED EDIT: <code block from chat>
           Apply the SUGGESTED EDIT to the ORIGINAL CODE. Output the complete modified file.
assistant: ```
````

The trailing `assistant` message (starting with a code fence) is a _prefill_ — it constrains the model to begin its response with a code block, preventing it from adding prose before the code. Anthropic's API explicitly supports this; other providers generally accept it silently.

For Claude Sonnet models specifically, a variant prompt is used that allows the model to emit `UNCHANGED CODE` markers instead of reproducing unchanged sections verbatim, reducing token usage on large files.

**Model used:** the model assigned to the `apply` role, falling back to the active chat model if no apply-specific model is configured (see section 3).

---

## 3. Model Roles: Assigning Models to Features

Continue routes different features to different LLM instances based on _roles_. This lets you use a powerful conversational model for chat while routing simpler tasks to cheaper or faster models — including models that expose only a raw completion API.

### Available roles

| Role           | Feature                               | Notes                                                                                       |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `chat`         | Chat, Agent, Plan conversations       | Selected in the Continue panel                                                              |
| `edit`         | Inline edit (Cmd+I)                   | Selected in Models config page and in the inline Cmd+I bar; falls back to active chat model |
| `apply`        | Apply button (LLM rewrite path)       | Selected in Models config page; falls back to active chat model                             |
| `autocomplete` | Tab autocomplete                      | Selected in Models config page; autocomplete is disabled if none selected                   |
| `summarize`    | Conversation auto-summarization       | Falls back to active chat model                                                             |
| `embed`        | Codebase indexing and semantic search | Required for `@codebase` / `@code` to work                                                  |
| `rerank`       | Re-ranking retrieved code chunks      | Optional; improves semantic search quality                                                  |

### How role assignment works

The `roles` array on a model entry controls which **candidate pool** that model belongs to. The actual model used for each feature is selected by the user in the GUI — not determined by the `roles` array alone. The `roles` array only determines which models are offered as choices in each selector.

| Role           | Where the active model is selected                  | Fallback if nothing selected |
| -------------- | --------------------------------------------------- | ---------------------------- |
| `chat`         | Model dropdown in the Continue panel                | —                            |
| `edit`         | Models config page + inline Cmd+I bar               | Active `chat` model          |
| `apply`        | Models config page (under "Additional model roles") | Active `chat` model          |
| `autocomplete` | Models config page                                  | Autocomplete disabled        |
| `embed`        | Models config page (under "Additional model roles") | —                            |
| `rerank`       | Models config page (under "Additional model roles") | —                            |

Selections made in the GUI are saved automatically and survive IDE restarts. They are stored separately from `config.yaml` so the config file is not modified when you switch models.

### Assigning roles in `config.yaml`

Each model entry in `config.yaml` has a `roles` array. When omitted, a model defaults to the roles `[chat, edit, apply, summarize]` — it appears as a candidate in the chat, edit, and apply selectors, but not in the autocomplete or embeddings selectors.

To make a model available only for autocomplete:

```yaml
models:
  - provider: openai
    model: gpt-4o
    name: GPT-4o
    # roles omitted → defaults to [chat, edit, apply, summarize]

  - provider: openai
    model: gpt-3.5-turbo
    name: GPT-3.5 Autocomplete
    roles: [autocomplete]
```

To make a local coding model available for autocomplete and inline editing, while keeping a hosted model for chat:

```yaml
models:
  - provider: anthropic
    model: claude-opus-4-7
    name: Claude for Chat
    roles: [chat, summarize]

  - provider: ollama
    model: deepseek-coder:6.7b
    name: DeepSeek Coder
    roles: [autocomplete, edit, apply]
```

After adding these entries, open the Models config page and select "DeepSeek Coder" in the Autocomplete, Edit, and Apply selectors to activate it for those features.

### Using models without a chat API

The behaviour depends on which feature is using the model:

**Edit and autocomplete** — these features produce a self-contained prompt string (from the edit or autocomplete template) and send it directly to the completion endpoint as-is. No chat formatting is applied and no wrapping in a user message happens. This makes raw completion models a natural fit for these use cases: the prompt is already structured as a standalone instruction, not as a conversation.

**Chat, plan, agent, and apply** — these features produce a list of messages (system, user, assistant, etc.). If the model has no native chat API, Continue formats that message list into a single string using the model's expected conversation format before sending it to the completion endpoint. This is handled automatically based on the model name, or can be set explicitly with the `template` field:

```yaml
models:
  - provider: ollama
    model: codellama:7b
    name: Code Llama
    roles: [autocomplete, edit]
    template: llama2 # explicit format override
```

Available template values: `llama2`, `llama3`, `alpaca`, `chatml`, `deepseek`, `gemma`, `zephyr`, `phind`, `openchat`, `codestral`, and others.

Because of this distinction, raw completion models are best suited to the `edit` and `autocomplete` roles. Using one for the `apply` role is possible but requires the chat formatter to convert the apply message list into a string, which may not work well with all models.

---

## 4. The Prompt Construction Pipeline

For every feature, the prompt passes through a pipeline before reaching the LLM API. Understanding the stages helps you see where configuration applies.

### Stage 1: Build the raw input

A _template function_ is called with the relevant inputs (file content, user instruction, conversation history, etc.) and produces either:

- A **plain string** — used for inline edit and autocomplete
- A **message list** — used for chat, agent, plan, and apply

### Stage 2: Inject system message and context

For chat/agent/plan mode, the full message list is assembled: context items are prepended to user messages and the system message (base + rules) is added at the top.

For inline edit, if rules or a base system message are active, the plain string is promoted to a two-message list with a `system` message prepended.

### Stage 3: Deliver to the LLM

- For models with a **chat API**: the message list is sent directly to the chat endpoint. A plain string is wrapped in a single `user` message first.
- For models with a **raw completion API only**: the message list is formatted into a single string in the model's conversation format, then sent to the completion endpoint.

---

## 5. Configuration: Prompting Options in `config.yaml`

### 5.1 Base system messages

Each mode has a built-in default system message. You can replace any of them per model using `chatOptions`:

```yaml
models:
  - provider: openai
    model: gpt-4o
    chatOptions:
      baseSystemMessage: "You are a senior Python engineer. Always use type hints."
      baseAgentSystemMessage: "You are an autonomous coding agent. Prefer small, focused edits."
      basePlanSystemMessage: "Help the user plan changes. Do not implement anything."
```

**Important:** the value you provide _replaces_ the entire built-in system message for that mode. Rules from `.continue/rules/` are still appended on top of your custom message.

The built-in defaults include instructions about code block formatting, how to present code modifications concisely, and mode-specific guidance (e.g. agent mode is told to use tools rather than output code blocks for implementation).

### 5.2 Custom prompt templates

For inline edit, apply, and autocomplete you can override the built-in prompt templates with your own Handlebars strings. These are set per model under `promptTemplates`:

```yaml
models:
  - provider: openai
    model: gpt-4o
    promptTemplates:
      edit: |
        Rewrite the following {{language}} code to satisfy the request.
        Code:
        {{codeToEdit}}
        Request: {{userInput}}
        Rewritten code:
      apply: |
        ORIGINAL:
        {{original_code}}
        CHANGE:
        {{new_code}}
        Output the complete updated file.
      autocomplete: "{{prefix}}<FILL>{{suffix}}"
```

#### Available placeholders by template

**`edit` template** (replaces the inline edit prompt):

| Placeholder      | Content                           |
| ---------------- | --------------------------------- |
| `{{prefix}}`     | File content above the selection  |
| `{{codeToEdit}}` | The selected code                 |
| `{{suffix}}`     | File content below the selection  |
| `{{userInput}}`  | Your Cmd+I instruction            |
| `{{language}}`   | File language (e.g. `typescript`) |

Note: the built-in template has conditional logic — it omits the prefix/suffix sections when they are empty, and switches to a different prompt for cursor-only or full-file cases. A custom string template applies uniformly; use Handlebars `{{#if prefix}}...{{/if}}` blocks if you need conditionals.

**`apply` template** (replaces the LLM full-rewrite apply prompt):

| Placeholder         | Content                                 |
| ------------------- | --------------------------------------- |
| `{{original_code}}` | Full file content at apply time         |
| `{{new_code}}`      | The code block from the chat suggestion |

Caution: the built-in apply prompt includes an assistant prefill (` ``` `) that constrains the model to start its response with a code block. A custom string template cannot produce a prefill, so the model may add introductory prose before the code.

**`autocomplete` template** (replaces the tab completion prompt):

| Placeholder    | Content                |
| -------------- | ---------------------- |
| `{{prefix}}`   | Code before the cursor |
| `{{suffix}}`   | Code after the cursor  |
| `{{filename}}` | File name              |
| `{{reponame}}` | Workspace folder name  |
| `{{language}}` | Language name          |

---

## 6. Configuration: Rules

Rules are the primary mechanism for injecting persistent instructions into the system message of chat, agent, plan, and inline edit sessions — without modifying the base system message itself.

### How rules work

Create `.md` files in your workspace at `.continue/rules/`. Each file is a rule. When you send a message, Continue evaluates which rules apply to the current context and appends the text of each applicable rule to the system message, in order.

### Rule targeting

Each rule file can have a YAML frontmatter block that controls when it fires:

```markdown
---
name: python-style
globs: "**/*.py"
alwaysApply: false
---

Always use type hints in Python function signatures.
Prefer `pathlib.Path` over `os.path`.
```

| Frontmatter field                           | Behaviour                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `alwaysApply: true`                         | Rule is always included, regardless of what files are in context                                                         |
| `globs`                                     | Rule is included only if a file matching the glob pattern is present in the current context items or message code blocks |
| `regex`                                     | Rule is included only if a file matching the glob also has content matching this regex                                   |
| No `globs`/`regex`, no `alwaysApply: false` | Root-level rules without targeting are implicitly global                                                                 |
| `alwaysApply: false` with no globs          | Rule is never auto-applied; can still be activated by `@rules` mention                                                   |

Rules can also be negative: prefix a glob with `!` to exclude files matching that pattern.

### Project-specific vs. workspace rules

Rules placed at `.continue/rules/` (in your workspace root) are root-level rules. Rules placed in a subdirectory (e.g. `backend/.continue/rules/api-style.md`) are scoped to that directory and only fire when files from that directory are in context.

### Practical patterns

**Always-on coding style:**

```markdown
---
alwaysApply: true
---

Use British English in all comments and documentation.
```

**Language-specific rules:**

```markdown
---
globs: ["**/*.ts", "**/*.tsx"]
---

Prefer `interface` over `type` for object shapes.
Always use `const` assertions for literal arrays passed as props.
```

**Framework-specific rules:**

```markdown
---
globs: "src/api/**/*.ts"
---

All API handlers must validate input with Zod before processing.
Return errors as `{ error: string }` with appropriate HTTP status codes.
```

---

## 7. Configuration: Context Providers

Context providers are the mechanism behind `@`-mentions in the chat input. They fetch content — file contents, git diffs, terminal output, documentation — and inject it as plain text into the user message, before your typed text.

### Built-in providers (always available)

These are available regardless of your `config.yaml`:

| `@`-mention    | What it provides                                                                    |
| -------------- | ----------------------------------------------------------------------------------- |
| `@file`        | Content of a specific file                                                          |
| `@currentFile` | Content of the currently active editor file (auto-included if the editor has focus) |
| `@diff`        | Current `git diff` output                                                           |
| `@terminal`    | Last command output from the IDE terminal (VS Code only)                            |
| `@problems`    | Diagnostics from the IDE problems panel (VS Code only)                              |
| `@rules`       | Manually include a specific rule from `.continue/rules/`                            |

### Configurable providers

Additional providers can be added under `context:` in `config.yaml`:

```yaml
context:
  - provider: code
  - provider: open
  - provider: docs
    params:
      startUrl: "https://docs.myframework.com"
```

Common configurable providers:

| Provider   | What it provides                                                                        |
| ---------- | --------------------------------------------------------------------------------------- |
| `code`     | Search for and attach specific functions, classes, or symbols from the indexed codebase |
| `open`     | Content of all currently open editor files                                              |
| `docs`     | Semantically searched documentation from a configured URL                               |
| `codebase` | Semantically searched chunks from the indexed codebase                                  |
| `folder`   | All files under a specific directory                                                    |
| `url`      | Content fetched from an arbitrary URL                                                   |

### How context reaches the LLM

When you submit a message, Continue fetches the content for each `@`-mentioned provider and prepends it to your message as plain text. The structure of the user message sent to the LLM is:

```
[content of @mention 1]
[content of @mention 2]
...
[your typed message]
```

This is inline within the `user` role message — not in the system message, and not in a separate turn. The LLM sees your context and question together as a single user turn.

**Note on `@currentFile`:** This provider is added automatically when you submit a chat message, provided the currently active editor window has focus. If you clicked the chat panel before submitting (which moves focus away from the editor), the active file is not known and `@currentFile` will not be included. Explicitly typing `@currentFile` in your message will always include it regardless of focus state.

### `@codebase` and semantic search

The `codebase` provider (and `code` provider) use the local vector index Continue maintains of your project. Relevant code chunks are retrieved by semantic similarity to your query, optionally re-ranked. This is the primary way to give the LLM access to project code without manually specifying files. It requires an `embed` model to be configured.

---

## 8. How Configuration Layers Interact

When multiple configuration sources are active at once, they combine as follows:

```
System message sent to LLM
= base system message (default or chatOptions override)
  + applicable rules from .continue/rules/ (appended in order)
  + conversation summary (if history was compressed)

User message sent to LLM
= [context item 1 content]
  [context item 2 content]
  ...
  [your typed text]
```

Rules are evaluated per message — a rule with `globs: "**/*.py"` only fires when a Python file appears in the context items or in code blocks you've pasted into the conversation. Changing which files you reference mid-conversation can activate or deactivate rules.

Prompt templates (`promptTemplates.edit`, etc.) are evaluated at the time the feature runs. They override the built-in template entirely — there is no merging with the default.

The base system message override (`chatOptions.baseSystemMessage`) replaces the entire built-in default for that mode. It does not suppress rule injection — rules are always appended on top.

---

## 9. Quick Reference

### Model role assignment

| Goal                                 | How                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Use a dedicated autocomplete model   | Add model with `roles: [autocomplete]`, then select it in the Models config page          |
| Use a dedicated inline edit model    | Add model with `roles: [edit]`, then select it in the Models config page or the Cmd+I bar |
| Use a dedicated apply model          | Add model with `roles: [apply]`, then select it in the Models config page                 |
| Use a local model without a chat API | Set the `template` field to the appropriate format (e.g. `llama2`, `chatml`)              |
| Enable semantic codebase search      | Add a model with `roles: [embed]`, then select it in the Models config page               |

### System message customization

| Goal                                         | How                                                               |
| -------------------------------------------- | ----------------------------------------------------------------- |
| Always add a project-specific instruction    | Create `.continue/rules/my-rule.md` with `alwaysApply: true`      |
| Add instructions only for certain file types | Create a rule with `globs: "**/*.ext"`                            |
| Replace the entire chat system message       | Set `chatOptions.baseSystemMessage` on the model in `config.yaml` |
| Replace the agent system message             | Set `chatOptions.baseAgentSystemMessage`                          |

### Prompt template customization

| Goal                               | How                                                         |
| ---------------------------------- | ----------------------------------------------------------- |
| Customize the inline edit prompt   | Set `promptTemplates.edit` under the model in `config.yaml` |
| Customize the apply rewrite prompt | Set `promptTemplates.apply` (note: loses assistant prefill) |
| Customize the autocomplete prompt  | Set `promptTemplates.autocomplete`                          |

### Context customization

| Goal                             | How                                                                   |
| -------------------------------- | --------------------------------------------------------------------- |
| Always include a file            | Add `@file path/to/file` in your message                              |
| Include the current file         | Ensure the editor has focus before submitting, or type `@currentFile` |
| Search the codebase semantically | Use `@codebase` or `@code` (requires `embed` model)                   |
| Include terminal output          | Use `@terminal` (VS Code only)                                        |
| Include compiler errors          | Use `@problems` (VS Code only)                                        |
| Add documentation as context     | Configure `docs:` in `config.yaml`, then use `@docs`                  |
