# Chat Message Templates

This document covers how `ChatMessage[]` arrays — the input to the `streamChat` route — are constructed from user input and environment parameters for each feature. These are distinct from:

- **Chat templates** — message formatters that convert `ChatMessage[]` → raw string for non-chat LLMs
- **Complete templates** — `PromptTemplateFunction`s that return a string for the `streamComplete` route

---

## 1. Chat / Agent / Plan mode

**Source:** `gui/src/redux/util/constructMessages.ts:37`

`constructMessages()` assembles the full `ChatMessage[]` array each time the user submits a message. The resulting structure is:

```
[ system? ]  [ user ] [ assistant ] [ tool* ] ... [ user ]
```

### System message

Built by `getSystemMessageWithRules()` (`core/llm/rules/getSystemMessageWithRules.ts:332`). It concatenates two sources:

**1. Base system message** — selected by mode in `getBaseSystemMessage()` (`gui/src/redux/util/getBaseSystemMessage.ts`):

| Mode    | Default content                | User override key                    |
| ------- | ------------------------------ | ------------------------------------ |
| `chat`  | `DEFAULT_CHAT_SYSTEM_MESSAGE`  | `chatOptions.baseSystemMessage`      |
| `agent` | `DEFAULT_AGENT_SYSTEM_MESSAGE` | `chatOptions.baseAgentSystemMessage` |
| `plan`  | `DEFAULT_PLAN_SYSTEM_MESSAGE`  | `chatOptions.basePlanSystemMessage`  |

The defaults are defined in `core/llm/defaultSystemMessages.ts` and contain instructions about code block formatting, lazy edit style, mode-specific guidance. If the user provides a value in `chatOptions`, it **replaces** the entire default — the defaults are not appended to.

**2. Rules** — `.continue/rules/` markdown files are filtered by `shouldApplyRule()`:

- Rules with `alwaysApply: true` or no globs/regex at the root level are always included.
- Rules with `globs` or `regex` are included only if they match file paths or content present in the current context items or message code blocks.
- Rules are appended to the base system message separated by blank lines.

If a conversation summary exists (from a prior auto-summarization), it is appended to the system message as `Previous conversation summary: ...`.

If the resulting system message is empty, no system message is added.

### User messages

Each user message is a `content` array (multipart):

1. **Context item parts** — each `@`-mentioned context item (and auto-added `@currentFile`) is prepended as a `{type: "text", text: item.content}` part.
2. **User text** — the actual typed message, appended after the context parts.

### Assistant messages

Prior assistant responses are included as-is. If the assistant made tool calls (agent mode), each tool call is followed by a `tool` message containing the tool output.

### Conversation history

`constructMessages()` starts from the most recent conversation summary (if any), dropping older turns. All non-empty, non-system turns from that point are included.

---

## 2. Apply mode — `defaultApplyPrompt`

**Source:** `core/llm/templates/edit/gpt.ts:75`

Called via `constructApplyPrompt()` in `core/edit/streamDiffLines.ts:47` when the user clicks Apply on a chat code block and the deterministic and unified-diff strategies have both failed. Returns a fixed two-message array:

````
user:      ORIGINAL CODE: ```...``` SUGGESTED EDIT: ```...``` Apply the SUGGESTED EDIT...
assistant: ```
````

Variable parts:

| Part            | Source                                  |
| --------------- | --------------------------------------- |
| `original_code` | Full content of the file at apply time  |
| `new_code`      | The code block from the chat suggestion |

The trailing `assistant` message with content ` ``` ` is an **assistant prefill** — it primes the model to begin its response with a code block, suppressing any introductory prose.

### Provider dependency

`renderPromptTemplate()` checks whether the last message has `role: "assistant"` and `canPutWordsInModelsMouth` is `false` (the default). If so, it tries to apply the provider's message formatter (the "chat template") to convert the array to a raw string. For PROVIDER_HANDLES_TEMPLATING providers (OpenAI, Anthropic, etc.) there is no message formatter, so the array is returned unchanged and the assistant prefill is passed directly to the chat API.

Anthropic, Ollama, and Mistral explicitly declare `supportsPrefill(): true`. Other providers accept or silently ignore the trailing assistant message depending on their API implementation.

---

## 3. Lazy apply — `claudeSonnetLazyApplyPrompt`

**Source:** `core/edit/lazy/prompts.ts`

Used for large files where the model may emit `UNCHANGED CODE` markers instead of reproducing unchanged sections. Returns a similar two-message array:

````
user:      ORIGINAL CODE: ```...``` NEW CODE: ```...``` [instructions]
assistant: ```
````

Variable parts are the same as `defaultApplyPrompt` (`original_code`, `new_code`). Currently only activated when the model name contains `"sonnet"`.

---

## 4. Edit mode with system message (rules or `baseChatSystemMessage` active)

**Source:** `core/edit/streamDiffLines.ts:117`

When `rulesToInclude` or `llm.baseChatSystemMessage` is set, the edit prompt (which is normally a string from `gptEditPrompt`) is promoted to a `ChatMessage[]`:

```
[ system: <systemMessage> ] [ user: <editPromptString> ]
```

If the template already returned a `ChatMessage[]` (e.g. a custom `promptTemplates.apply` template that somehow returns messages, or `defaultApplyPrompt`), the system message is prepended instead:

```
[ system: <systemMessage> ] ... existing messages ...
```

If the existing array already has a system message, the new rules are merged into it.

---

## User customization options

### System message (chat/agent/plan)

In `config.yaml`, under any model entry:

```yaml
models:
  - provider: openai
    model: gpt-4o
    chatOptions:
      baseSystemMessage: "You are a helpful assistant focused on Python."
      baseAgentSystemMessage: "You are an autonomous coding agent. Use tools liberally."
      basePlanSystemMessage: "Help the user plan changes without implementing them."
```

These replace the corresponding default system message entirely. Rules from `.continue/rules/` are still appended on top.

### Rules (system message additions)

Place `.md` files in `.continue/rules/`. Each file becomes a rule that is conditionally appended to the system message. Frontmatter controls when the rule applies:

```markdown
---
name: python-style
globs: "**/*.py"
alwaysApply: false
---

Always use type hints in Python function signatures.
```

Fields:

- `alwaysApply: true` — rule is always included regardless of files
- `globs` — glob pattern(s); rule is included only if a file matching the pattern is in the current context
- `regex` — regex pattern(s); rule is included only if a matching file's content contains the pattern
- No `globs`/`regex` at root level → implicitly global

### Apply message (apply mode)

Users can override `defaultApplyPrompt` via `promptTemplates.apply` in `config.yaml` with a Handlebars string (see `PromptTemplateConfig.md`). However, a string template cannot produce the assistant prefill that `defaultApplyPrompt` includes, which may cause the model to add prose before the code block.

---

## Key source locations

| File                                              | Relevance                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `gui/src/redux/util/constructMessages.ts:37`      | `constructMessages()` — full ChatMessage[] for chat/agent/plan       |
| `gui/src/redux/util/getBaseSystemMessage.ts`      | Mode → base system message selection                                 |
| `core/llm/defaultSystemMessages.ts`               | Default system message content for each mode                         |
| `core/llm/rules/getSystemMessageWithRules.ts:332` | Assembles base message + applicable rules                            |
| `core/llm/rules/getSystemMessageWithRules.ts:276` | `getApplicableRules()` — glob/regex rule filtering                   |
| `core/llm/templates/edit/gpt.ts:75`               | `defaultApplyPrompt` — apply mode ChatMessage[]                      |
| `core/edit/lazy/prompts.ts`                       | `claudeSonnetLazyApplyPrompt` — lazy apply ChatMessage[]             |
| `core/edit/streamDiffLines.ts:117`                | Edit mode: wraps string prompt into [system, user] when rules active |
| `packages/config-yaml/src/schemas/models.ts:117`  | `chatOptionsSchema` — `baseSystemMessage` and variants               |
