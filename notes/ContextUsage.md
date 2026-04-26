# How the `context:` Section of `config.yaml` Is Used

The `context:` array in `config.yaml` declares which context providers are available to the user as `@`-mentions in the chat input. This document traces how these providers are loaded, what they do, and how their output reaches the LLM.

---

## 1. Config loading — `loadConfigContextProviders()`

**Source:** `core/config/loadContextProviders.ts:22`

When `config.yaml` is loaded, `loadConfigContextProviders()` processes the `context:` array in three steps:

### Step 1 — Instantiate listed providers

For each entry in `context:`, it looks up the class by `provider` name:

```ts
const cls = contextProviderClassFromName(config.provider);
```

`contextProviderClassFromName()` (`core/context/providers/index.ts:77`) scans the `Providers` array and matches by `cls.description.title`. The class is then instantiated with any `params` from the config entry:

```ts
providers.push(new cls({ name: config.name, ...config.params }));
```

### Step 2 — Add missing default providers

Six providers are always available regardless of config:

| Default provider | Class                        | VS Code only? |
| ---------------- | ---------------------------- | ------------- |
| `file`           | `FileContextProvider`        | No            |
| `currentFile`    | `CurrentFileContextProvider` | No            |
| `diff`           | `DiffContextProvider`        | No            |
| `terminal`       | `TerminalContextProvider`    | Yes           |
| `problems`       | `ProblemsContextProvider`    | Yes           |
| `rules`          | `RulesContextProvider`       | No            |

If any of these are missing from the explicitly listed providers, they are appended automatically. `terminal` and `problems` are filtered out for JetBrains.

### Step 3 — Add `DocsContextProvider` if docs are configured

If the config has any `docs:` entries, `DocsContextProvider` is added automatically.

### Result

All providers end up in `config.contextProviders: IContextProvider[]`, which is part of the loaded `ContinueConfig` object.

---

## 2. Provider types

Each provider class declares a static `description.type`:

| Type        | Behaviour                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `"normal"`  | Activated by `@title` in chat; returns items immediately without a submenu                                            |
| `"submenu"` | Activated by `@title`; shows a dropdown of selectable sub-items (e.g. `@code` lets you search for specific functions) |
| `"query"`   | Activated by `@title query`; the typed text after the mention is passed as the query string                           |

---

## 3. Providers from `config-example.yaml`

| Config entry  | Provider class               | Type      | What it provides                                                          |
| ------------- | ---------------------------- | --------- | ------------------------------------------------------------------------- |
| `code`        | `CodeContextProvider`        | `submenu` | Search for and attach specific code symbols or snippets from the codebase |
| `diff`        | `DiffContextProvider`        | `normal`  | Current `git diff` output                                                 |
| `currentFile` | `CurrentFileContextProvider` | `normal`  | Full content of the currently active editor file                          |
| `terminal`    | `TerminalContextProvider`    | `normal`  | Last command output from the IDE terminal (VS Code only)                  |
| `open`        | `OpenFilesContextProvider`   | `normal`  | Content of all currently open editor files                                |
| `problems`    | `ProblemsContextProvider`    | `normal`  | Diagnostics/errors from the IDE problems panel (VS Code only)             |

All six of these are also in the default provider list, so they would be added automatically even without being listed in `config.yaml`. Listing them explicitly is only needed if you want to pass custom `params` or control ordering.

---

## 4. GUI — how providers are presented to the user

`config.contextProviders` (as descriptions, not full instances) is synced to the GUI's Redux store at `state.config.config.contextProviders`.

- **`@`-mention dropdown** (`gui/src/components/mainInput/AtMentionDropdown/index.tsx`): shows available providers filtered by what the user has typed after `@`. Clicking a provider triggers a `context/getContextItems` request to preview results.
- **Submenu preloading** (`gui/src/context/SubmenuContextProviders.tsx`): for providers with `type === "submenu"`, submenu items are preloaded via `context/loadSubmenuItems` when the config loads, so the dropdown can show items immediately.

---

## 5. When the user submits a message

**Source:** `gui/src/components/mainInput/TipTapEditor/utils/resolveEditorContent.ts`

1. **Parse editor state** — `processEditorContent()` extracts all `@`-mentions from the TipTap editor's JSON state. Each mention becomes a `GetContextRequest { provider, query }`.

2. **Add defaults** — `experimental.defaultContext` providers (if any) are appended as additional requests. The `currentFile` provider is also added automatically unless the `noContext` modifier is active.

3. **Fetch context items** — For each request, `resolveEditorContent.ts:152` calls:

   ```ts
   ideMessenger.request("context/getContextItems", {
     name,
     query,
     fullInput,
     selectedCode,
   });
   ```

4. **Core handles the request** — `core/core.ts:1455` receives the message, finds the matching provider in `config.contextProviders` by `name`, and calls:

   ```ts
   provider.getContextItems(query, { config, llm, ide, embeddingsProvider, reranker, ... })
   ```

   The provider fetches the actual content from the IDE or file system and returns `ContextItem[]`.

5. **Items stored in Redux** — The returned items are stored in `contextItems` on the current `ChatHistoryItem` in `state.session.history`.

---

## 6. How context items reach the LLM

**Source:** `gui/src/redux/util/constructMessages.ts:83`

When the message array is assembled for the LLM request, `constructMessages()` prepends all context items from `item.contextItems` as plain-text content parts at the top of each user message:

```
[context item 1 content]
[context item 2 content]
...
[user's typed message]
```

This is inserted into the `user` message's `content` array before the user's actual text. The LLM receives the context inline — there is no separate system message for context items.

---

## Key source locations

| File                                                                      | Relevance                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `core/config/loadContextProviders.ts:22`                                  | Instantiates providers from config; adds defaults                          |
| `core/context/providers/index.ts:43`                                      | `Providers` registry — all available provider classes                      |
| `core/context/providers/index.ts:77`                                      | `contextProviderClassFromName()` — name → class lookup                     |
| `core/core.ts:1455`                                                       | `getContextItems()` — handles `context/getContextItems` message from GUI   |
| `core/core.ts:592`                                                        | `loadSubmenuItems()` — handles `context/loadSubmenuItems` message from GUI |
| `gui/src/components/mainInput/TipTapEditor/utils/resolveEditorContent.ts` | Parses `@`-mentions and gathers context items before message submission    |
| `gui/src/context/SubmenuContextProviders.tsx:467`                         | Preloads submenu items for `type === "submenu"` providers                  |
| `gui/src/redux/util/constructMessages.ts:83`                              | Prepends context items to each user message before LLM request             |
