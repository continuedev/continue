# Plan: model and provider setup (Track A)

Status: plan only, no code written. Written 2026-11-02 against `origin/main` eccd7c562. See [`ROADMAP.md`](./ROADMAP.md) for where this sits.

## 1. Problem

1. The setup wizard cannot be reopened to edit a configuration. After the first run, the only ways back are Help > Quickstart (which starts a new session and opens the tutorial) or hand-editing config.yaml.
2. Each provider contributes one chosen model. You cannot enable several models from one provider, or from several providers, in one pass.
3. You cannot pick a set of models per mode (Chat, Plan, Agent) and switch among them quickly. Today a mode maps to exactly one model.

## 2. Current state (read from the code)

| Piece                | Where                                                                                           | What it does today                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding card      | `gui/src/components/OnboardingCard/*`                                                           | Shown to new users, or from Help > Quickstart. The API-key tab offers OpenAI, Anthropic and Gemini, each with a key field; "Connect" uses only the first key filled in. "View more providers" opens the Add Model form.                         |
| Onboarding save      | `core/config/onboarding.ts` (`setupProviderConfig`), message `onboarding/complete`              | Adds a fixed list of two or three models per provider; the user does not choose. If provider and model already exist, only the key is updated.                                                                                                  |
| Add Model form       | `gui/src/forms/AddModelForm.tsx`, `addModelFormUtils.ts`, `modelListUtils.ts`                   | One provider, one model from a dropdown, then `config/addModel`. It can already fetch the provider's live model list and has a Bedrock connection test, but you can only choose one model.                                                      |
| Add model save       | `core/config/util.ts` (`addModel`), `core/core.ts` (`config/addModel`)                          | Appends one model to config.yaml. If provider and model already exist it shows a toast and opens the file. There is no edit from the GUI. `config/deleteModel` exists in core, but nothing in `gui/src` calls it (only core and a binary test). |
| Per-mode models      | `packages/config-yaml/src/schemas/index.ts` (`modeModels`), `core/config/yaml/modeModels.ts`    | `modeModels.<mode>: { model, reasoningEffort }`. One model per mode. Unknown names are dropped with a non-fatal error.                                                                                                                          |
| Applying mode models | `gui/src/hooks/useApplyModeModel.ts`, `redux/thunks/applyModeModel.ts`, `ui.modeModelOverrides` | Switching mode selects that mode's model. A manual pick is remembered per mode until reload.                                                                                                                                                    |
| Chat model picker    | `gui/src/components/modelSelection/ModelSelect.tsx`                                             | A dropdown of every chat model. `Cmd+'` cycles through all of them.                                                                                                                                                                             |
| Mode menu            | `gui/src/components/ModeSelect/ModeSelect.tsx`                                                  | Shows the model and effort each mode uses.                                                                                                                                                                                                      |
| Models tab           | `gui/src/pages/config/sections/ModelsSection.tsx`, `ModelRoleSelector.tsx`                      | One dropdown per role (Chat, Autocomplete, Edit, Apply, Embed, Rerank). The gear opens the YAML file.                                                                                                                                           |
| Saving YAML          | `core/util/paths.ts` (`editConfigYaml`)                                                         | `YAML.parse` then `YAML.stringify`, which drops every comment in the file on each GUI save.                                                                                                                                                     |

## 3. Goals and non-goals

Goals:

- Reopen setup at any time from the Models tab, the model picker and a command, and edit what is already configured.
- Enable several models from one or more providers at once, with favourites chosen by default.
- Choose, per mode, which models appear when switching, plus a default per mode.
- Keep hand-edited config.yaml intact: comments, ordering and unknown fields survive GUI saves.

Non-goals (this track):

- Editing models in workspace or Hub profiles (v1 edits the global file only).
- Autocomplete, Edit, Apply, Embed and Rerank lists. These roles really use one model, so they stay single-select.
- Changing how providers are called.

## 4. Design

### 4.1 Config format (backward compatible)

```yaml
modeModels:
  plan:
    model: Claude Opus # default when you switch into Plan (unchanged)
    models: [Claude Opus, GPT-5, Gemini 3 Pro] # NEW: models offered while in Plan
    reasoningEffort: medium
  agent:
    model: Claude Sonnet
    models: [Claude Sonnet, GPT-4.1 mini]
```

- `packages/config-yaml/src/schemas/index.ts`: add `models: z.array(z.string()).optional()` to `modeModelSchema`, and make `model` optional when `models` is given.
- `core/config/yaml/modeModels.ts`: validate each name and drop unknown names with a non-fatal error (as today). If `models` is set and `model` is not, the default is the first entry. The default is always included in the offered set.
- `core/index.d.ts`: add `titles?: string[]` to the resolved mode setting.
- Existing configs behave exactly as before.

### 4.2 Saving without losing comments

`editConfigYaml` does `YAML.parse` then `YAML.stringify`, which drops every comment. I ran both approaches with the `yaml` 2.9.1 that `core` uses, on a small commented sample containing a `${{ secrets.* }}` key:

- The current approach lost all three comments.
- `YAML.parseDocument`, edited in place (adding a model and a `modeModels.plan.models` list), kept every comment, the key order and the `${{ secrets.* }}` values.
- It is not a byte-for-byte round trip. Runs of blank lines collapse to one, spaces before a trailing comment collapse to one, and short inline lists are re-spaced (`[chat]` becomes `[ chat ]`) unless `flowCollectionPadding: false` is passed.

Decision: use `parseDocument` with `flowCollectionPadding: false`, accept the blank-line and comment-spacing normalization, skip the write when nothing changed, and keep one `config.yaml.bak` from before the first GUI edit so a user who versions the file can compare. Add vitest cases for comments, key order, unknown fields, secret references, and an invalid file being left untouched.

### 4.3 New core messages

Added to `core/protocol/core.ts` and `core/protocol/passThrough.ts`, and handled in `core/core.ts`. The old `config/addModel` and `onboarding/complete` stay for compatibility.

| Message                     | Purpose                                                                                                                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/getProviderSetup`   | Return configured models grouped by provider and connection (provider plus `apiBase`, region or profile). Says whether a key is saved; never returns the key itself.                                                                                                    |
| `config/saveProviderModels` | `{ provider, connection, apiKey?, add, remove }`. One config edit. Matches existing entries by provider, model and connection and merges into them, so hand-added fields survive. Removing a model also removes it from `modeModels`. Reuses `modelEnvFromDescription`. |
| `config/setModeModels`      | Write the `modeModels` block (default, offered models and reasoning effort per mode).                                                                                                                                                                                   |

The IntelliJ plugin keeps its own list of message names (`extensions/intellij/.../MessageTypes.kt`). This plan does not require JetBrains support for the new messages, but that list must be updated if they are to be reachable there.

### 4.4 GUI

- **Picker (A2).** When the current mode has an offered list, show it first as "<Mode> models" and the rest under "All models". `Cmd+'` cycles only the offered list (everything when none is set). Add a "Manage models..." entry. The mode menu shows "Opus +2" when a mode has several.
- **Models tab (A3).** Replace the Chat dropdown with a table. Rows are chat models grouped by provider. Columns are Chat, Plan and Agent checkboxes, a star for each mode's default, and a reasoning-effort select. Add a Providers card: one row per provider and connection, with Edit, Refresh models and Add provider.
- **Setup flow (A4).** Extract a `ProviderSetupFlow` from `AddModelForm` with three steps:
  1. Provider and credentials. Reuse `getRenderableFields`, the Bedrock connection tester and live refresh. In edit mode the key field reads "saved - leave blank to keep".
  2. Model checklist (`ModelChecklist`). Checkboxes, search (reuse `fuzzyScore`), and the popular/live grouping from `computeModelLists`. Configured models start checked; for a new provider the popular ones start checked.
  3. Review. List additions and removals, and ask before removing anything.

  The onboarding API-key tab uses this flow instead of the fixed lists. The Local (Ollama) tab is unchanged.

- **Ways back in.** The Models tab Providers card, "Manage models..." in the picker, an "Edit providers and models" action under Configs, and a `continue.openModelSetup` command (`extensions/vscode/package.json` and `commands.ts`) that sends the existing `setupApiKey` webview message.

### 4.5 Where API keys are stored (a user setting)

Today `addModel` writes the key into each model entry, so checking five models for one provider would write five copies. Instead the setup flow asks once per provider connection where the key should live, and every checked model refers to it.

| Option                                  | What is written                                                                                                  | Trade-off                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secure storage (default when available) | The key goes to the IDE's secret storage. config.yaml gets `apiKey: ${{ secrets.CONTINUED_<PROVIDER>_API_KEY }}` | Encrypted in VS Code. The CLI and other tools cannot read it. Needs a new lookup source (below).                                                             |
| `~/.continue/.env`                      | The key is appended to `.env`. config.yaml gets the same reference                                               | Plaintext. Works with anything that reads `.env`. The fallback when the IDE has no secret storage.                                                           |
| Environment variable                    | Nothing is stored. config.yaml gets a reference to a name the user types                                         | For keys injected by something else, such as a secrets manager that launches the editor.                                                                     |
| Inline in config.yaml                   | The key is written into the file, as today                                                                       | Simplest. The key sits in a file people sync or commit. On Windows the extension does not tighten file permissions (`setConfigFilePermissions` skips win32). |

Default: secure storage if a test write and read-back succeeds (the same check `mcpOauthStore.ts` uses for MCP OAuth tokens, #14), otherwise `.env`. The choice is remembered. Existing configs are not touched; a "Move key to secure storage" action on the Providers card converts one, after confirmation.

What I checked:

- Local config loading resolves `${{ secrets.NAME }}` from `~/.continue/.env`, then `<workspace>/.continue/.env`, then `<workspace>/.env`, then the process environment (`core/config/yaml/LocalPlatformClient.ts`, used by `loadYaml.ts` with `renderSecrets: true`). `docs/faqs.mdx` and `docs/configuration.mdx` document the syntax. The 8 existing `LocalPlatformClient` tests pass (run today).
- I found no code that writes `~/.continue/.env`, and secret storage is not a lookup source. A1 adds both.
- A reference that cannot be resolved stays in the config as literal text and is used as the key. Run on 2026-11-02: a model with `apiKey: ${{ secrets.CONTINUED_ANTHROPIC_API_KEY }}` and no matching secret, rendered through `renderSecrets` with `LocalPlatformClient`, came back with `apiKey` equal to that literal text and no error (section 4.6). `LLMConfigurationStatuses.MISSING_ENV_SECRET` exists and the Models tab already shows "(Missing env secret)" for it, but only the Relace provider overrides `getConfigurationStatus` (with `MISSING_API_KEY`), so nothing sets it for this case.

### 4.6 A config that arrives without its secrets

Secure storage is per machine. A config.yaml that is synced or copied to another machine keeps `apiKey: ${{ secrets.CONTINUED_ANTHROPIC_API_KEY }}`, but the key is not there. Today that is invisible until a request fails: the probe in section 4.5 shows the literal text becomes the key, so the provider rejects it and the user sees an authentication error that does not mention a missing secret.

**Detect it at load time** (A1). After secrets are rendered, any model field that still holds a `${{ secrets.NAME }}` reference is unresolved. The check is a string scan using the existing `getTemplateVariables`, run on the rendered YAML in `loadYaml.ts`. For each unresolved name it records:

- the secret name, which models use it, and the provider (so the message can say "Anthropic");
- where it was looked up (secure storage, `~/.continue/.env`, workspace `.env` files, process environment), so the message can say where a value would be found.

The result goes out in three places:

1. **A non-fatal config error** per secret, in the existing `configError` list. The Configs tab and the toolbar already show these. The message names the secret and the models, and carries a new optional field `action` on `ConfigValidationError` (`{ kind: "setSecret", secretName, provider }`), so the GUI knows what to offer. `uri` already exists on that type for "open this file".
2. **`MISSING_ENV_SECRET` on the model**, so the Models tab shows "(Missing env secret)" and the model cannot be picked, as it already works for invalid entries (`ModelRoleSelector.tsx`). BaseLLM gets this from a flag on the options set when the key still contains an unresolved reference.
3. **No request is sent with the literal text.** `BaseLLM` refuses to call out when its key is an unresolved reference and throws "API key for <name> is not set on this machine", with the same action attached. This covers existing users who already have `${{ secrets.* }}` in their config.

**Show it with an indicator, not a banner.** The UI already has a warning triangle in the toolbar above the chat input (`BlockSettingsTopToolbar.tsx`). It appears whenever the config error list is non-empty and links to the Configs tab. The per-model gear in the model picker (`ModelSelect.tsx`) and the Models tab rows have no indicator. This plan adds to those and does not add a banner or a new place to look.

| Where                                                                         | Change                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The toolbar warning triangle (already there)                                  | Keep it. When the cause is a missing key, the tooltip reads "Anthropic key is not set on this machine" instead of the generic "View configuration errors", and a click opens a small popover with the fix, not the whole Configs tab. Other errors keep today's behaviour. |
| The gear in the model picker header and on each model row (`ModelSelect.tsx`) | Show a small warning dot on the gear when the selected model, or a row's model, has an unset key. Tooltip: "Key not set on this machine". Click opens the same popover. No dot when nothing is wrong.                                                                      |
| The Models tab model rows and Providers card                                  | Replace "(Missing env secret)" text with a warning icon and "Key not set", same popover on click.                                                                                                                                                                          |
| A failed request                                                              | The error text from item 3 above names the secret and has an "Enter key" button, using the `GhostButton` row that `StreamError.tsx` already has for "Check API key" and "View config".                                                                                     |

The popover is one small component used from all four places (the existing `Popover` in `gui/src/components/ui`). It lists each affected provider with one line and three actions:

- **Enter key** opens the setup flow at step 1 for that provider, with fields filled in from config.yaml. Saving writes the secret where the user chose (section 4.5) and reloads; config.yaml is unchanged because the reference is already correct. One entry fixes every model that shares the secret.
- **Open .env**, which opens `~/.continue/.env` (created if missing, with `CONTINUED_ANTHROPIC_API_KEY=` ready to fill in).
- **Open config line**, which opens config.yaml at the model's `apiKey` line. Built in A0 (#98) by searching the config text for the reference, so no YAML position tracking is needed; a secret used from another block file falls back to opening the main config.

A "Copy name" button sits next to the secret name for people who set it as an environment variable.

**No nagging.**

- The indicator shows only for a model that is selected or listed, never as a count of every unresolved secret in the file.
- A user on a managed machine whose keys come from the process environment never sees it, because the lookup finds them.
- A user who has deliberately left a model unconfigured can dismiss the indicator for that secret. The dismissal is stored by secret name only and cleared when the secret is set.

**Not doing:** exporting a config for another machine. A synced config simply shows the indicator on the new machine, which is the whole prompt the user needs.

## 5. PR breakdown

| PR  | Contents                                                                                                                                                                                                                                                                                                           | Tests                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A0  | Missing-secret detection (section 4.6): unresolved-reference scan after rendering, a non-fatal error per secret with an `action`, `MISSING_ENV_SECRET` on the model, refusal to send the literal reference as a key, the toolbar and gear indicators, and a popover with Open .env, Open config line and Copy name | core vitest for the scan (resolved, unresolved, several models sharing one secret, a reference inside a non-key field); gui tests for the indicator and popover |
| A1  | Schema, `resolveModeModels`, comment-preserving `editConfigYaml`, the three messages, secret-storage lookup and `.env` writer, `docs/reference.mdx` `modeModels` update                                                                                                                                            | config-yaml schema tests; core vitest for resolve, merge/remove, comment preservation and the secret lookup                                                     |
| A2  | Mode-aware picker and `Cmd+'` cycling; mode menu hint; helpers in `gui/src/util/modeModels.ts`                                                                                                                                                                                                                     | gui vitest for the helpers and for cycling                                                                                                                      |
| A3  | Checkbox table and Providers card on the Models tab, using the shared key-not-set indicator                                                                                                                                                                                                                        | gui vitest for the table; update e2e selectors if they reference the old dropdown                                                                               |
| A4  | `ProviderSetupFlow`, `ModelChecklist`, onboarding integration, command and entry points; adds Enter key to the popover, opening the flow at step 1                                                                                                                                                                 | gui vitest for the checklist and review step; e2e onboarding selectors (`extensions/vscode/e2e/selectors/GUI.selectors.ts`)                                     |

A0 and A1 have no dependency on each other and can land in either order. A2, A3 and A4 follow A1. A0 is useful on its own: it fixes the confusing authentication error for anyone who already has a `${{ secrets.* }}` reference they have not set, and its popover actions (open `.env`, open the config line, copy the name) need no secret writer.

Key storage (section 4.5) is split across PRs. A1 carries the core pieces: the secret-storage lookup in `LocalPlatformClient` and a writer for `~/.continue/.env`. A4 carries the storage choice in the setup flow, the "Move key" action and "Enter key". A0 carries only detection, so it needs neither.

## 6. Decisions and defaults

| Question                                   | Default                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where do per-mode sets live?               | `modeModels.<mode>.models`. The alternative, a `modes:` field on each model, is rejected because it changes the main model schema.                                                                                                   |
| One API key per model, or a shared secret? | A user setting in the setup flow, one secret per provider connection (section 4.5). Default: secure storage when available, otherwise `~/.continue/.env`. Other choices: an environment variable, or inline in config.yaml as today. |
| Which file is edited?                      | The global `~/.continue/config.yaml` (what `editConfigFile` writes). Other profiles show "Open file".                                                                                                                                |
| Does Chat get its own column?              | Yes. Chat, Plan and Agent are separate keys in `modeModels` already.                                                                                                                                                                 |

## 7. Acceptance criteria

- From a configured install, the Models tab opens the setup flow with existing models checked. Unchecking one and confirming removes it from config.yaml and from every `modeModels` list.
- Selecting four models for Plan and two for Agent shows exactly those in the picker for each mode, and `Cmd+'` cycles only within the current mode's set.
- After a GUI save, every comment, key, value and the key order outside the edited entries is preserved. Whitespace may be normalized (section 4.2).
- An existing config with only `modeModels.<mode>.model` behaves exactly as before.

## 8. Risks

| Risk                                                                                             | Mitigation                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `YAML.parseDocument` edits change formatting more than expected                                  | Golden-file tests on a commented sample config before building on it.                                                                                                                                              |
| Removing a model that a `modeModels` entry or a selected role still names                        | The save step removes it from `modeModels`; if it was the selected model, fall back to the mode default.                                                                                                           |
| Merging into hand-edited entries matches the wrong model (same model id on two endpoints)        | Match on provider, model and connection (`apiBase`, region, profile); show ambiguous matches in the review step.                                                                                                   |
| The setup flow outgrows `AddModelForm` and regresses Bedrock                                     | Extract by moving code; keep `AddModelForm.bedrock.test.tsx`, `addModelFormUtils.test.ts` and `modelListUtils.test.ts` green.                                                                                      |
| One very large GUI change                                                                        | A2, A3 and A4 are separate PRs behind the A1 data model.                                                                                                                                                           |
| The unresolved-reference scan flags text that is not a secret (an example in a prompt or a rule) | Scan only the fields that hold credentials (`apiKey`, `env.*`, `requestOptions.headers`) and report a name only if it matches the secret-name pattern; test with a rule that mentions `${{ secrets.X }}` in prose. |
| Refusing to send a literal reference breaks someone who truly uses that text as a key            | A key that is exactly a `${{ secrets.NAME }}` reference is never a valid key for any provider; the message says how to set it.                                                                                     |
| The indicator nags a user who intentionally has no key on this machine                           | Per-secret dismissal, stored by name only, cleared when the secret is set; shown only for a model that is selected or listed.                                                                                      |

## 9. Not verified

Written from reading the code, plus two things run on 2026-11-02: the existing `LocalPlatformClient` tests, and a comparison of `YAML.stringify` against `YAML.parseDocument` on a sample file (section 4.2). Nothing else was built or run. Still unchecked:

- Secret resolution end to end in a running extension (only the unit tests and the one probe in section 4.5 were run).
- Which characters a secret name may contain. `CONTINUED_<PROVIDER>_API_KEY` uses only capitals and underscores, like the names in the docs.
- Whether JetBrains supports `readSecrets` and `writeSecrets`. The CLI and test host return nothing (`core/util/filesystem.ts`), so there the default falls back to `.env` and the missing-secret banner has nowhere secure to save to.
- That `parseDocument` behaves the same on real user configs. The test plan should include a few.
- Whether an optional `action` field on `ConfigValidationError` (a type in `packages/config-yaml`, shared with the Hub schema and the CLI) is safe to add. It is optional, but the CLI and JetBrains plugin both consume that type.
- Which providers read their key from a field other than `apiKey` (Bedrock uses `env.accessKeyId` and `env.secretAccessKey`; Azure and others have their own). The scan has to cover those; I only checked `apiKey` end to end.
- (Resolved in A0, #98.) The refusal went into the public `BaseLLM` methods (`streamChat`, `complete`, `streamComplete`, `streamFim`, `embed`, `rerank`), not a fetch wrapper, so every subclass is covered without touching providers. Not covered: a provider that bypasses those methods.
