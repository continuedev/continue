# Providers, models and assignments

Last updated: 2026-11-07. Status: research and design; nothing built. Follows Track A (`model-config-ux.md`) and provider accounts (#290).

Configure each provider once, define each model once, and mix them freely by role and mode: a local Strata server for Act, Claude on Bedrock for Plan, a small model for autocomplete. The same setup works in the editor, in VS Code's own chat and Agents window, and in `cn`.

## The problem

1. **Two systems for the same thing.**
   - Provider accounts (#290) are named connections in `providers.yaml`, which models use with `connection: <name>`.
   - The setup flow (onboarding, "Manage models", the local server entry from #313) ignores them. It writes `provider`, `apiBase` and a key reference into every model, and groups models by provider and address (`core/config/providerSetup.ts`).
   - So setting up Bedrock and Strata today gives inline copies, not reusable accounts.
2. **No reusable model definitions.**
   - A model's context window, capabilities, completion options and `contextManagement` live in one config's `models` list.
   - A second config, or the CLI, copies them.
   - The Strata launcher writes a whole config file of its own.
3. **Variants are duplicates.** The same Strata model at reasoning effort xhigh for Plan and low for Act is two models with copied fields (the launcher's `strata.yaml`). Nothing says they are one model, so a change to one is not made to the other, and the cache warnings treat a switch between them as a model change.
4. **One model, several routes.** Claude Sonnet on Anthropic, on Bedrock (an inference-profile ARN) and on OpenRouter are unrelated entries. Nothing can fall back from one to another.
5. **Assignments are names in a config.**
   - `modeModels` and roles pick models by name from that config's list.
   - Setup works one provider at a time, so there is no single place to see every model from every account and assign them.
6. **The Agents window cannot use Continued's setup.**
   - It runs its own extension host, with no views, sidebar or status bar.
   - It shares the default profile's settings, `chatLanguageModels.json`, `mcp.json` and secrets, but not the extension's `globalState`.
   - Continued's setup lives in its webview, so none of it is reachable there.

## What others do

From the research in the PR that adds this plan (sources there and in the linked docs):

| Tool           | Provider and model                                                                                                                              | Variants                                                                                       | Per role                                                                              | Credentials                              | Fallback                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| opencode       | `providers.<id>` with `settings` (`baseURL`, key), and `models.<key>` with `modelID`, `capabilities`, `limit`, request quirks (`compatibility`) | `variants`, chosen as `provider/model#variant`; generated from `capabilities.reasoning.effort` | Agents name `provider/model#variant`; a subagent without one inherits                 | `/connect`, `{env:X}`                    | none                                               |
| Zed            | `language_models.<provider>` and named `openai_compatible.<name>` with `available_models`                                                       | through `mode` and `reasoning_effort` per model                                                | `agent.default_model`, `subagent_model`, `inline_assistant_model`, `compaction_model` | OS keychain; `<ID>_API_KEY` env override | none                                               |
| Claude Code    | aliases (`opus`, `sonnet`) mapped per provider (`ANTHROPIC_DEFAULT_*_MODEL`, `modelOverrides` to Bedrock ARNs)                                  | `effort`                                                                                       | `opusplan`; subagent `model` or `inherit`                                             | env and the AWS chain                    | `fallbackModel`, at most three                     |
| LiteLLM        | `model_list`: an alias (`model_name`) to a deployment (`litellm_params`), credentials in `credential_list`                                      | two aliases on one deployment                                                                  | n/a                                                                                   | named credentials, `os.environ/X`        | `fallbacks`, `context_window_fallbacks`, cooldowns |
| Roo Code       | one profile = provider and model                                                                                                                | none                                                                                           | a profile per mode, remembered                                                        | one secret blob per profile              | none                                               |
| Cline          | per-mode provider and model ids, but shared endpoint fields                                                                                     | none                                                                                           | Plan and Act                                                                          | fixed secret list                        | none                                               |
| VS Code (BYOK) | provider groups in `chatLanguageModels.json`, from a provider's contributed `configuration` (keys marked `secret`)                              | `configurationSchema` per model                                                                | `chat.utilityModel` and others                                                        | SecretStorage, `${input:…}`              | Auto mode routes                                   |

Lessons:

- **Three layers:** provider, then model, then variant, merged in that order (opencode).
- **Roles name models, never providers.** Cline's shared endpoint fields mean Plan and Act cannot use two different local servers.
- **A canonical model name with a per-provider id** gives "the same model" on each route, and fallback between routes (Claude Code, LiteLLM).
- **Keys outside the config, referenced by name.**
- **Limits and capabilities explicit, filled in from the server or a catalog, with defaults marked as assumptions.**

## What this fork has

| Piece                                                                                                                                    | Where                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Provider accounts: `providers.yaml` (global and workspace), `connection:` on a model, the Provider accounts card, `providers/*` messages | #290, `core/config/providerInstances*`, `packages/config-yaml` connections |
| Setup flow with live model lists, connections keyed by provider and address                                                              | `core/config/providerSetup.ts`, `gui/src/components/ProviderSetup/`        |
| Local server detection, and the context, tools and images servers report                                                                 | #313, `core/llm/localServers.ts`                                           |
| Per-mode model lists and reasoning effort (`modeModels`)                                                                                 | Track A, `packages/config-yaml/src/schemas/index.ts`                       |
| Config profiles: create, copy, rename, delete                                                                                            | #290                                                                       |
| Models shared with VS Code chat (`continued` vendor) and MCP servers                                                                     | #296, `extensions/vscode/src/ai/`                                          |
| Keys in secure storage or `~/.continue/.env`, plaintext key migration                                                                    | #290                                                                       |
| Per-model `contextManagement` (CLI)                                                                                                      | #316                                                                       |

## Design

### 1. Three layers

```yaml
# ~/.continue/providers.yaml: accounts (exists today)
providers:
  - name: strata
    provider: openai
    apiBase: http://127.0.0.1:8080/v1/
  - name: bedrock-us
    provider: bedrock
    env: { region: us-east-1 }
    apiKey: ${{ secrets.CONTINUED_BEDROCK_US_API_KEY }}

# ~/.continue/models.yaml: the model catalog (new)
models:
  - name: Qwen3.8 Flash
    connection: strata
    model: qwen3.8-flash-next-nvfp4-nvfp4
    contextLength: 524288
    capabilities: [tool_use, image_input]
    defaultCompletionOptions: { maxTokens: 8192, temperature: 1.0 }
    variants:
      plan:
        { requestOptions: { extraBodyProperties: { reasoning_effort: xhigh } } }
      act:
        { requestOptions: { extraBodyProperties: { reasoning_effort: low } } }
  - name: Claude Sonnet
    model: claude-sonnet-4-6
    routes: # one model on several accounts; the first that works is used
      - connection: bedrock-us
        model: us.anthropic.claude-sonnet-4-6
      - connection: anthropic-work

# a config: assignments (the existing format, with references)
modeModels:
  plan: { model: Claude Sonnet }
  agent: { model: Qwen3.8 Flash#act }
models:
  - from: Qwen3.8 Flash # a catalog entry, used as is
    roles: [chat, edit, apply]
  - from: Claude Sonnet
    roles: [chat]
```

**Accounts** stay as they are.

**The catalog** is new: `~/.continue/models.yaml`, plus a workspace `.continue/models.yaml` that overrides by name.

- An entry has everything a model has today except its connection fields. It names its account with `connection:`.
- `variants` holds only what differs: completion options, request options, reasoning effort, `contextManagement`. A variant is picked as `Name#variant`.
- `routes` lists accounts that serve the same model, each with its own wire id, tried in order.

**A config** keeps today's format. A model entry can now be `from: <catalog name>` (with `roles` and any overrides), next to inline models.

- `modeModels` and roles name catalog models or variants.
- Merge order: account, then catalog model, then variant, then the config entry's own fields. Objects merge; scalars and lists replace.
- An unknown name or variant is a non-fatal error that skips that model, as unknown connections are today.

Everything is backward compatible: inline models with `provider`/`apiBase`/`apiKey`, and `connection:` models, keep working unchanged.

### 2. Setup writes accounts and catalog entries

The setup flow becomes the editor for all three layers:

- **Credentials** creates or edits an account in `providers.yaml`, instead of writing the address and key into each model.
  - "Local server" and Detect create an account per server found (`strata`, `lm-studio`).
  - Re-detecting finds the existing account by address.
- **Models** adds catalog entries with what the provider reported: context window, tools, images, and the variants a model's reasoning efforts allow (as opencode generates them).
- **Assign** is a new step, and also a page of its own. It is one table of every catalog model from every account against the roles and modes (Plan, Agent, Chat, Edit, Autocomplete, Subagents, Compaction), so local and cloud models are picked side by side.
- **Migration:** inline models that share a provider, address and key are offered as one "Turn into an account" action, which writes the account and catalog entries and replaces the inline models with `from:`. Comments and key order are kept, as config saving already does.

### 3. One model, several routes

A catalog model with `routes` is one model in the pickers. A request goes to the first route. The next route is tried on:

- a connection or authorization failure;
- a "model not available" or throttling error from Bedrock;
- a context-length error, only when a later route has a larger window.

Like Claude Code's chain, at most three routes. The cache warnings treat a route change as a model change (each route has its own cache), and the chat shows which route answered.

### 4. VS Code, the Agents window and `cn`

- **One resolver in core** turns accounts, the catalog and a config into the models in use. It reads only files and secrets, never the webview's or the extension's `globalState`, so the Agents window's extension host, which has its own `globalState`, resolves the same models.
- **VS Code chat and the Agents window:**
  - The `continued` language model provider (#296) offers catalog models and their variants, not only the selected config's chat models.
  - With the proposed `chatProvider` API it marks them `isBYOK` with accurate token limits, vision and a `reasoningEffort` enum (`configurationSchema`). VS Code's Agents window forwards only BYOK models without `targetChatSessionType` to its agent sessions.
  - The extension declares `capabilities.agentsWindow.supported`, and does nothing there that needs views or the status bar.
- **Accounts in VS Code's Language Models editor:**
  - The extension contributes `languageModelChatProviders[].configuration`: account fields, with the key marked `secret: true`.
  - VS Code then offers "Add Models" for Continued, keeps the key in SecretStorage, and passes each named group's configuration to the provider.
  - A group maps to an account, so accounts can be added from the Agents window, where Continued's sidebar does not exist.
  - The API is pre-final (microsoft/vscode#291012), so `providers.yaml` stays the source and VS Code groups are read as extra accounts until it is final.
- **`cn`** reads the same `providers.yaml` and `models.yaml`. Its route into the Agents window is an Agent Host Protocol server (AHP 1.0, October 2026), added with "Agents: Add Remote Agent Host". It uses the same catalog, so a model set up once is available to every agent.
- **The Strata launcher** writes one account and one catalog entry (with plan and act variants) instead of a config file of its own, and updates the account's address when it changes the port.

## Phases

| Phase | Scope                                                                                                                                                                                     | Depends on             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| C1    | Catalog: `models.yaml` (global and workspace), `from:` in configs, `Name#variant`, the merge order, errors. Schema in `packages/config-yaml`, resolver in core, used by the IDE and `cn`. | none                   |
| C2    | Setup writes accounts and catalog entries; Detect creates local accounts; "Turn into an account" migration.                                                                               | C1                     |
| C3    | The Assign page: every catalog model against roles and modes, including Subagents and Compaction.                                                                                         | C1                     |
| C4    | Variants generated from reported reasoning efforts; switching between variants of one model does not count as a model change in the cache warnings.                                       | C1                     |
| C5    | Routes and fallback, with the route shown in the chat and in the cache warnings.                                                                                                          | C1                     |
| C6    | VS Code: catalog models and variants through the `continued` provider, `isBYOK` and limits (proposed `chatProvider`), `capabilities.agentsWindow.supported`.                              | C1                     |
| C7    | Accounts from VS Code's Language Models editor (`languageModelChatProviders[].configuration`), behind a setting until microsoft/vscode#291012 lands.                                      | C6                     |
| C8    | `cn` as an Agent Host Protocol server on the same catalog.                                                                                                                                | C1, parallel-agents A2 |

Status (2026-11-07): C1 to C5 are built on `claude/plan-provider-model-config` for 2.4. C6 and C7 (VS Code and its Agents window) are built on `next/2.6`, with parallel agents. C8 is blocked: parallel-agents A2 (agents that run without the webview through `cn serve`) does not exist yet, and A2 waits on A1. `cn` already reads the same `providers.yaml` and `models.yaml` (C1), so the catalog is ready for it once A2 lands.

C1 to C4 are the core of the request: providers configured once, models defined once, mixed by role.

## Open questions

1. Should the catalog be its own file (`models.yaml`), or a `models:` section in `providers.yaml`? A separate file keeps accounts (with key references) apart from models that are safe to share in a repository.
2. Should `from:` also accept a file path (`from: ./models/strata.yaml`)? Configs already use `uses:` for blocks (file paths and hub slugs), which is why catalog references use their own key.
3. Variants generated from reported reasoning efforts: all of them, or only the ones the user picks? Built in C4: all of them, since an unused variant costs nothing and the Assign table lists each.
4. Should a route change keep the conversation on the new route, or go back to the first route on the next request? Built in C5: it stays on the route that answered while that route's prompt cache is warm, and goes back to the first after 5 minutes idle, when the cache has most likely expired anyway. An account that failed is skipped for 5 minutes, across config reloads.
5. How should Continued and VS Code's Language Models editor stay in step once both can add accounts: one-way import, or two-way?
