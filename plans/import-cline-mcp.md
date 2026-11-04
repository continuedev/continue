# Import MCP servers from Cline

Roadmap "Later" item, from `fork-plan.md` section 4.7, item 4. Tracked in `ROADMAP.md`.

## Problem

Anyone who already runs Cline has MCP servers configured in Cline's settings file. Setting them up again in `config.yaml` is tedious and error-prone, and the copy usually means pasting API tokens from a JSON file into YAML.

## Design

### Finding the file

`candidateSettingsPaths` lists where the file can be, and `findSettingsFiles` returns those that exist. All are under the editor's user data directory, in `User/globalStorage`:

| OS      | User data directory                      |
| ------- | ---------------------------------------- |
| Linux   | `~/.config/<Editor>`                     |
| macOS   | `~/Library/Application Support/<Editor>` |
| Windows | `%APPDATA%\<Editor>`                     |

with `<Editor>` one of `Code`, `Code - Insiders`, `VSCodium`, `Cursor`, `Windsurf`.

- Cline: `saoudrizwan.claude-dev/settings/cline_mcp_settings.json`.
- Roo Code (same format, so trivial to support): `rooveterinaryinc.roo-cline/settings/mcp_settings.json`, or the Cline file name in older versions.
- Cline CLI: `~/.cline/data/settings/cline_mcp_settings.json`.

### Conversion

Each entry under `mcpServers` becomes one entry of this repo's `mcpServers`:

| Cline / Roo                                | config.yaml                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| `command`, `args`, `env`, `cwd`            | same fields (stdio)                                   |
| `url`, `type: sse`                         | `url`, `type: sse`                                    |
| `type: streamableHttp` / `streamable-http` | `url`, `type: streamable-http`                        |
| `headers`                                  | `requestOptions.headers`                              |
| `timeout` (seconds)                        | `connectionTimeout` (milliseconds)                    |
| `alwaysAllow` (Roo), `autoApprove` (Cline) | `toolPermissions.allow: mcp__<server>__<tool>` rules  |
| `disabled: true`                           | skipped (config.yaml has no per-server disabled flag) |

An entry with an unknown `type`, no `command` or no `url` is skipped and reported. Duplicates are skipped by name, ignoring case, against the servers already in the global `config.yaml`.

### Secrets

A value is treated as a credential when its key (env var name, header name, query parameter) matches `key|token|secret|passw|credential|auth|bearer|cookie|session`, or the value has a well-known token prefix (`ghp_`, `sk-`, `xox*-`, `AKIA`, ...). Such values are never written to `config.yaml`:

- The file gets `${{ secrets.<SERVER>_<KEY> }}`. In an `Authorization: Bearer x` header, only the token is replaced, giving `Bearer ${{ secrets.NAME }}`. A credential in a URL query string is replaced the same way.
- With "store the credential values now" on, the value goes through `storeSecret` (the A4 secret writer: the editor's secure storage or `~/.continue/.env`). An existing secret with that name is never overwritten.
- With it off, or if storing fails, the reference is still written and an empty `NAME=` line is added to `~/.continue/.env`, so the existing missing-secret flow prompts for it.
- Secret values never go to the webview. The preview carries names only, and the import re-reads the file in core. The request carries a `sourcePath` that must be one of the detected files, so the webview cannot make core read an arbitrary file.

Values that do not look like credentials (a log level, a path) are copied as they are.

### Writing

Servers and allow rules are added with `editConfigFile`, which edits the YAML document in place (`yamlEdit.ts`), so comments, order and anchors survive, and a `.bak` copy is made on first edit. Only the global `config.yaml` is supported; a `config.json`-only setup gets an error, as for the other GUI editors.

### Protocol and UI

- `config/previewMcpImport` (no input): detected files, and per server `new` / skipped with reason, the secret names, and the count of auto-approved tools.
- `config/importMcpServers` (`sourcePath`, `names`, `storeSecrets`, `storage`): result with imported, skipped, stored and pending secrets, and warnings.
- Both are in `core/protocol/core.ts`, `passThrough.ts` and `MessageTypes.kt`.
- In Settings > Tools, an "Import MCP servers from Cline" button above the MCP server list, shown only when a file with servers is found. It opens a dialog with a checkbox per server, the skipped ones with reasons, the credential names, and the storage choice.

## PRs

1. Core conversion, import, protocol, GUI dialog, fixtures, tests, and this plan. One PR; the pieces are small and only useful together.

## Tests

- `core/config/importClineMcp.vitest.ts` with fixture files in `core/config/fixtures/clineMcp/`: paths per OS, every transport, header and query secrets, duplicates, disabled and invalid entries, comment preservation, idempotence, not overwriting existing secrets, store failure, unknown source path, no config.yaml.
- `gui/src/pages/config/components/ImportClineMcp.test.tsx`: button hidden or shown, opens the dialog.

## Risks

- The per-OS paths come from Cline's documentation and third-party guides, and the Roo Code and CLI paths could not be checked against official docs. They are one list in one function, easy to correct.
- Servers set up with `disabled: true` are skipped, not imported as off.
- The credential heuristic can miss a secret with an unusual name, or treat a harmless value as one. The second only costs a secret reference; the first leaves the value in `config.yaml`. The dialog lists the credential names before importing.
- A remote workspace may keep Cline's file on a different machine than core runs on. Detection then finds nothing.
- Cline's `timeout` is read as seconds.
