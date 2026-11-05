# Plan: import settings from other tools (Track G)

Status: plan only, nothing built. Roadmap row G. Scope of the first PRs: model providers and model selection, and MCP servers, for Claude Code, Cursor and OpenCode (and Cline and Roo, whose MCP import exists). Codex, Gemini CLI, VS Code and Zed are researched in section 3 and are candidates for later adapters. Rules, permissions and skills come later (section 8).

Read on 2026-11-05 from each tool's own documentation and from the code in this repo. What was not checked is listed in section 9.

## 1. Problem

People arrive with a working setup in Claude Code, Cursor, OpenCode, Cline or Roo Code: providers and keys, a model per task, and a set of MCP servers. Today the only way across is to retype it. Cline and Roo Code MCP servers already have an importer (`importClineMcp.ts`, PR #193), but it scans for the file as soon as Settings > Tools opens and covers MCP only.

The import must be a manual process the user starts and steps through. Nothing reads another tool's files until they choose a tool, and nothing is written until they confirm.

## 2. What exists

- `core/config/importClineMcp.ts`: finds the settings files, converts each server, replaces credentials with `${{ secrets.NAME }}` references, stores values through `storeSecret`, and edits `config.yaml` in place so comments survive. The preview carries secret names, never values, and the request carries a `sourcePath` that must be one of the files core found. This is the model to extend, not replace.
- `core/config/providerSetup.ts` (Track A, A4): `saveProviderModels` takes a provider, a connection (`apiBase`, `region`, `profile`), models to add, and a key with a storage choice (`secure`, `env`, `envVar`, `inline`). The wizard calls it; so can the importer.
- `ProviderSetupFlow` (credentials, models, review) opens in the app dialog through `useProviderSetupDialog`. A new wizard sits beside it and ends by calling the same save path.
- `modeModels` in `config.yaml` (A1 to A3): a list of models per mode (Chat, Plan, Agent), one default each.
- Hooks in `.claude/settings.json` are already read by the CLI, and `.claude/skills` and `CLAUDE.md` are already loaded. Those need no import.

## 3. What each tool keeps

Facts below are quoted or paraphrased from the tool's documentation, read on 2026-11-05.

### 3.1 MCP servers

Claude Code:

- Where: `.mcp.json` in the project (project scope); `~/.claude.json` top-level `mcpServers` (user scope); `~/.claude.json` under `projects.<path>.mcpServers` (local scope).
- Shape: `type` of `stdio`, `http` or `sse`; `command`, `args`, `env`; `url`, `headers`; `oauth` with `clientId` and `callbackPort`.
- Variables: `${VAR}` and `${VAR:-default}` in `command`, `args`, `env`, `url` and `headers`.

Cursor:

- Where: `~/.cursor/mcp.json` and `.cursor/mcp.json`.
- Shape: `mcpServers`. Stdio has `type`, `command`, `args`, `env`, `envFile` (stdio only). Remote has `url`, `headers`, and `auth` with `CLIENT_ID`, `CLIENT_SECRET`, `scopes`.
- Variables: `${env:NAME}`, `${userHome}`, `${workspaceFolder}`, `${workspaceFolderBasename}`, `${pathSeparator}`, `${/}`, in `command`, `args`, `env`, `url` and `headers`.

OpenCode:

- Where: `mcp` in `opencode.json` or `opencode.jsonc`, globally under `~/.config/opencode/` or in the project root.
- Shape: `type` of `local` or `remote`. Local has `command` as an array, `cwd`, `environment`, `enabled`, `timeout` (ms). Remote has `url`, `headers`, `oauth`, `enabled`, `timeout`.
- Variables: `{env:VAR}` and `{file:path}`.

Cline and Roo Code: already handled by #193, see `import-cline-mcp.md`.
More tools that keep MCP servers in a file, read on 2026-11-05 (none is in scope for G1; they are candidates for a later adapter, each a small one because the shape is the same idea):

- OpenAI Codex CLI: TOML, not JSON. `~/.codex/config.toml` or a project `.codex/config.toml`, one `[mcp_servers.<name>]` table per server. Stdio has `command`, `args`, `env`, `env_vars` (names to forward), `cwd`. Streamable HTTP has `url`, `bearer_token_env_var`, `http_headers`, `env_http_headers` (header name to variable name), `http_headers_helper` (a command). Timeouts are in seconds (`startup_timeout_sec`, default 10; `tool_timeout_sec`). Credentials are named by environment variable, which maps cleanly onto our secret references.
- Gemini CLI: `mcpServers` in `~/.gemini/settings.json`. `command`, `url` (SSE) or `httpUrl` (streamable HTTP); `args`, `headers`, `env`, `cwd`, `timeout` (ms, default 600,000), `trust` (skips tool confirmations for that server), `includeTools`, `excludeTools`. Variables: `$VAR` and `${VAR}` everywhere, `%VAR%` on Windows only; an undefined variable becomes an empty string. `trust: true` must not be carried across: it removes a safeguard, so it is listed and left off.
- VS Code: `.vscode/mcp.json` uses a top-level `servers` object, while portable files (workspace-root `.mcp.json`, a user `mcp.json`) use `mcpServers`. VS Code's own docs say not to copy between the two formats without checking, and that input variables are not supported in portable files. An adapter has to read both and map the input-variable prompts to secret references.
- Zed: `context_servers` in the settings file. `command`, `args`, `env`; or `url` and `headers`. A remote server with no `Authorization` header triggers OAuth sign-in.
- Windsurf: its documentation returned 403 to a plain request, so its format is not recorded here.

What carries across all of them: a command or URL, arguments, and environment entries that are either literal values or names of variables. Where a tool lets the user name a variable (Codex's `env_vars`, `bearer_token_env_var`; Cursor's `${env:}`; OpenCode's `{env:}`; Gemini's `$VAR`), the import keeps it a name.

Rules that follow from this:

- Claude Code has three places for servers and a precedence among them (local, then project, then user). A duplicate name takes the whole entry from the highest, with no merging. The importer lists all three and marks which one wins, instead of picking silently.
- A variable reference is not a secret. `${API_KEY}`, `${env:API_KEY}` and `{env:API_KEY}` become a `${{ secrets.API_KEY }}` reference (see 4.2), not a resolved value, so no value is copied. `${workspaceFolder}` and `${userHome}` have no equivalent in config.yaml; for a project file they are resolved to the path at import time with a warning, otherwise the server is listed as needing attention.
- `disabled` (Cline, Roo) and `enabled: false` (OpenCode) are not imported, as in #193. They are listed as skipped with the reason.
- Cursor `auth` holds `CLIENT_SECRET`, which follows the secret rule. OAuth sign-in tokens are never read from another tool's store.

### 3.2 Providers and models

Claude Code:

- Where: the `env` block of `~/.claude/settings.json` (also `.claude/settings.json` and `.claude/settings.local.json`). The `/setup-bedrock` wizard writes there.
- Bedrock: `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION`, `AWS_PROFILE`, `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_BEDROCK_REGION_PREFIX`, and the pins `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`.
- Vertex: `CLAUDE_CODE_USE_VERTEX=1`, `CLOUD_ML_REGION`, `ANTHROPIC_VERTEX_PROJECT_ID`, `ANTHROPIC_VERTEX_BASE_URL`.
- Other keys: `model`, `modelOverrides` (an Anthropic model ID mapped to a provider model ID or inference profile ARN), `availableModels`, and the commands `apiKeyHelper` and `awsAuthRefresh`.

OpenCode:

- Where: `provider` in `opencode.json`; `model` and `small_model` written as `provider/model`; credentials added with `/connect` in `~/.local/share/opencode/auth.json`.
- `provider.<id>.options` holds `baseURL`, `apiKey`, `headers`, and for Bedrock `region`, `profile` and `endpoint`. `provider.<id>.models` lists models. `npm` is `@ai-sdk/openai-compatible` for chat completions and `@ai-sdk/openai` for the responses API. `blacklist` and `whitelist` hide model IDs. Keys are usually `{env:VAR}` or `{file:path}`.
  OpenAI Codex CLI (read 2026-11-05, a candidate for a later adapter): `model` and `model_provider` in `~/.codex/config.toml`; a custom provider is a `[model_providers.<id>]` table with `name`, `base_url`, `env_key` (the variable holding the key), `wire_api` (`responses` is the only value) and `requires_openai_auth`. The built-in IDs `openai`, `ollama` and `lmstudio` are reserved. `experimental_bearer_token` holds a key directly and the docs discourage it; it follows the secret rule if it is ever read. `env_key` is a name, so it maps onto the `envVar` storage choice.

Cursor, Cline and Roo Code keep models and keys in the app and its secret storage, not in a file, so there is nothing to read. The wizard shows them as "MCP servers only" instead of pretending.

What follows:

- Claude Code through Bedrock or Vertex yields a provider, a region or profile, and up to three pinned model IDs. That maps onto `saveProviderModels` with `provider: bedrock` or `vertexai`, a connection, and models named from the pins. It carries no credentials: Bedrock auth is the AWS profile, which is already a field of the connection.
- An `apiKeyHelper` or `awsAuthRefresh` is a command that runs in a shell. It is shown in the preview and never run, never copied into config.yaml, and never turned into a hook.
- OpenCode `{env:NAME}` becomes the `envVar` storage choice (the entry reads the same variable), which is what the user already set. `{file:path}` is listed as needing attention: reading a path out of another tool's config and copying the contents is not done unless the user picks the file.
- Keys in `auth.json` are the only place a value exists on disk. They are off by default, one checkbox per provider, go through `storeSecret`, and never reach the webview.
- A pinned model ID such as `us.anthropic.claude-opus-4-8` is taken as written. The importer does not rewrite prefixes or translate IDs between providers.

### 3.3 Model selection

- Claude Code: `model` (an alias such as `sonnet`, or a full ID) is the default; the three pins say what the aliases mean.
- OpenCode: `model` is the default and `small_model` the one for light tasks.
- Continue has `modeModels` (a list per mode and one default) and the `summarize` and `subagent` roles. The wizard proposes: the tool's default model becomes the Agent and Plan default, and its small model becomes the `summarize` role. The user changes any of it on the review screen before applying. Chat is left alone unless the user ticks it.

## 4. Design

### 4.1 One wizard, an adapter per tool

A new dialog, "Import from another tool", opened from Settings (a button beside the model and MCP sections) and from the command palette. It never opens by itself and has no first-run behaviour.

Steps:

1. Pick a tool: Claude Code, Cursor, OpenCode, Cline, Roo Code. Each shows what it can bring (providers, models, MCP servers). A scan for files on this machine runs only after the user picks that tool.
2. Pick what to bring: providers and models; MCP servers. Each item has a checkbox. Items needing attention show why and start unchecked.
3. Review: exactly what will be written to config.yaml and where each secret goes, names only. Nothing is written before this screen's button.
4. Result: what was added, skipped and why, and what still needs a value (a pending secret opens the existing "Enter key" flow).

Core side, one module per tool behind a shared interface:

```ts
interface ImportAdapter {
  tool: "claude-code" | "cursor" | "opencode" | "cline" | "roo";
  /** Files to look at, for this OS. No reading. */
  candidates(env: SettingsEnv, workspaceDirs: string[]): ImportSource[];
  /** Parse one file into the neutral shape. Never throws. */
  read(source: ImportSource, text: string): ImportedSettings;
}
```

`ImportedSettings` is `{ servers, providers, models, defaults, notices }`. The conversion to config.yaml entries, the secret handling, the `sourcePath` check and the in-place YAML edit are shared. The Cline and Roo code moves behind this interface unchanged.

### 4.2 Secrets

The rule from #193 stands and is extended:

- A value whose key looks like a credential, or whose value has a known token prefix, becomes a `${{ secrets.NAME }}` reference. With "store the values now" ticked it goes through `storeSecret`; otherwise an empty `NAME=` line is added to `~/.continue/.env`.
- A reference to another variable is a name, not a value. It becomes `${{ secrets.API_KEY }}` with no value copied, and the review screen says "reads API_KEY from your environment today".
- Values never reach the webview. The preview carries names. The import re-reads the file in core.
- The webview sends a source identifier and the chosen item names, never a path. Core only reads files it listed itself.
- Nothing is read from another tool's token stores (OAuth tokens, `auth.json` values) unless the user ticks that provider's key box.

### 4.3 Where it writes

`config.yaml` only (global), through the existing in-place edit with a `.bak` on first edit. A `config.json`-only setup gets the same message as the other editors. Model entries go through `saveProviderModels`, so they appear in the Models tab and the normal setup flow, with the same duplicate handling ("Another connection to that endpoint already exists").

### 4.4 Protocol

- `config/importScan` (`{ tool }` returning the detected sources and a preview): scanning happens only when called.
- `config/importApply` (`{ tool, sourceId, items, storeSecrets, storage }` returning a result).
- `config/previewMcpImport` and `config/importMcpServers` stay until the wizard replaces their one caller, then go.

## 5. PR breakdown

| PR  | Scope                                                                                                                                                                                                                                                                 | Depends on |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| G0  | `ImportAdapter` interface and the neutral shape; Cline and Roo moved behind it with their tests unchanged; `importScan` and `importApply`; the scan on opening Settings > Tools removed                                                                               | none       |
| G1  | Adapters for Claude Code, Cursor and OpenCode, MCP servers only: the three Claude scopes with precedence, Cursor interpolation, OpenCode `{env:}`; fixtures from the docs; secret tests                                                                               | G0         |
| G2  | The wizard UI: pick a tool, pick items, review, result; entry from Settings and the command palette; component tests                                                                                                                                                  | G0         |
| G3  | Providers and models: Claude Code (Bedrock, Vertex, the pins, `modelOverrides`), OpenCode (`provider`, `model`, `small_model`, Bedrock options, custom OpenAI-compatible), mapped onto `saveProviderModels` and `modeModels`; keys from `auth.json` behind a checkbox | G0, G2, A4 |
| G4  | Docs page for the wizard; roadmap update                                                                                                                                                                                                                              | G3         |

G1 and G2 can go in parallel after G0.

## 6. Tests

- Fixtures built from the documentation examples: a Claude `.mcp.json` with `${VAR:-default}`; a `~/.claude.json` with a project-scoped server of the same name as a user-scoped one; a Cursor `mcp.json` with `envFile` and `auth`; an OpenCode `opencode.jsonc` with comments, `{env:}` and a local server whose `command` is an array.
- Per adapter: every transport, a duplicate name across scopes, a disabled entry, an entry of an unknown `type`, an empty file, a file that is not JSON, a JSONC file with comments and trailing commas.
- Secrets: a credential in `env`, in `headers`, in a URL query, in `auth.CLIENT_SECRET`; a variable reference that must not become a value; a case where storing fails; an existing secret is never overwritten. A test that no preview or result object contains any secret value (a canary string in the fixtures).
- The request check: a source identifier core did not list is refused.
- Wizard: it reads nothing until a tool is chosen; nothing is written before the review button; a cancelled review changes no file.
- Providers: the Claude Bedrock pins become the models in the right connection; an existing connection is not duplicated; `apiKeyHelper` appears in the preview and nowhere in the written config.

## 7. Risks

- The documentation can change under us. Paths are one function per adapter, easy to correct.
- A heuristic for secret-looking names can miss an unusual name. The review screen lists every environment entry's name and whether it will be treated as a secret, so a miss is visible before applying.
- Claude Code's local scope lives in a large file with unrelated data (account details, counters, a history of projects). The adapter reads only `mcpServers` and `projects.<path>.mcpServers`, drops the rest in memory, and never writes to that file.
- A project file (`.mcp.json`, `.cursor/mcp.json`, `opencode.json`) can come from a repository the user does not trust and can name a command to run. The review screen shows the command in full and marks servers that come from a project file. Importing a server is not running it, but it makes it available to the agent, so project-sourced servers start unchecked.
- Model IDs differ between tools for the same model. The importer copies the ID as the other tool sends it to the same provider, so it works wherever it worked there, and does not translate between providers.
- A remote workspace may keep the other tool's files on a different machine than core runs on. Detection then finds nothing and says so.

## 8. Later

Rules (`CLAUDE.md` is already loaded; `.cursor/rules/*.mdc` with `description`, `globs` and `alwaysApply` map onto Continue rules; Cline's `.clinerules`), permissions (Claude `permissions.allow/ask/deny` and OpenCode `permission` map onto `toolPermissions`, but an allow list widens what the agent may do, so those start unchecked and the tool names need a verified table), skills, and hooks. Each is its own plan once G3 is in.

## 9. Not verified

- The exact shape of an entry in Claude Code's `~/.claude.json` local scope was read from the documentation, not from a real file: the file on the machine I checked had no project with servers.
- Cursor's remote `type` values and whether `auth` can sit beside `headers` were read from the documentation. One real `mcp.json` on that machine had both `auth` and `headers` on one server, which agrees.
- OpenCode's file formats were read from its documentation; no OpenCode install was available to check against.
- OpenCode's `auth.json` is at `~/.local/share/opencode/auth.json` per its documentation; the Windows and macOS locations are not stated there.
- Cursor's user-level rules live only in its app; nothing to import.
- Codex, Gemini CLI, VS Code and Zed were read from their documentation only, and no install of any of them was available. Windsurf was not read (its documentation refused a plain request).
- None of the UI exists yet, so nothing here has been clicked through.
