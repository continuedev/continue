# Naming Spec — Yuto Agentic

Single source of truth for product identity in this fork. When in doubt, use the slug `yutoagentic` and the display string `Yuto Agentic`.

## Identifiers

| Concept                        | Value                                                 | Replaces                                           |
| ------------------------------ | ----------------------------------------------------- | -------------------------------------------------- |
| Display name                   | `Yuto Agentic`                                        | `Continue`                                         |
| Slug / package basename        | `yutoagentic`                                         | `continue`                                         |
| npm scope                      | `@yutoagentic`                                        | `@continuedev`                                     |
| CLI binary                     | `yt`                                                  | `cn`                                               |
| Native binary artifact         | `yutoagentic-binary`                                  | `continue-binary`                                  |
| Global config dir              | `~/.yutoagentic/`                                     | `~/.continue/`                                     |
| Env var (config dir)           | `YUTOAGENTIC_GLOBAL_DIR`                              | `CONTINUE_GLOBAL_DIR`                              |
| Workspace ignore file          | `.yutoagenticignore`                                  | `.continueignore`                                  |
| Workspace rc file              | `.yutoagenticrc.json`                                 | `.continuerc.json`                                 |
| VS Code extension id           | `YutoAgentic.yutoagentic`                             | `Continue.continue`                                |
| VS Code command/setting prefix | `yutoagentic.*`                                       | `continue.*`                                       |
| JetBrains plugin id            | `com.github.yutoagentic.yutoagenticintellijextension` | `com.github.continuedev.continueintellijextension` |
| Kotlin package root            | `com.github.yutoagentic.yutoagenticintellijextension` | `com.github.continuedev.continueintellijextension` |
| Gradle root project            | `yutoagentic-intellij-extension`                      | `continue-intellij-extension`                      |
| macOS keychain bundle id       | `dev.yutoagentic.yutoagentic`                         | `dev.continue.continue`                            |
| Docs/links domain placeholder  | `yutoagentic.dev`                                     | `continue.dev`                                     |

## Backend endpoints (configurable)

The fork does **not** ship pointing at any live backend. The following env vars override the placeholders in `core/control-plane/brandEnv.ts`. When unset, cloud features (hub, auth, telemetry) are disabled.

| Env var                        | Purpose                                   |
| ------------------------------ | ----------------------------------------- |
| `YUTOAGENTIC_API_URL`          | Control-plane / proxy URL                 |
| `YUTOAGENTIC_APP_URL`          | Marketing / app URL                       |
| `YUTOAGENTIC_HUB_URL`          | Hub registry URL                          |
| `YUTOAGENTIC_WORKOS_CLIENT_ID` | WorkOS OAuth client id                    |
| `YUTOAGENTIC_POSTHOG_KEY`      | PostHog project key for product analytics |
| `YUTOAGENTIC_SENTRY_DSN`       | Sentry DSN for error reporting            |

## Renaming rules

1. Never blind replace `Continue` or `continue` — both collide with the JS keyword and with prose. Always anchor regexes to brand-tied prefixes/suffixes (e.g. `@continuedev/`, `continue.dev`, `.continue` (path), `Continue.continue`, `continue-binary`, `CONTINUE_GLOBAL_DIR`, `com.github.continuedev`).
2. `scripts/check-rebrand.sh` enforces this in CI. New occurrences of forbidden identifiers will fail PRs unless added to its allowlist.
3. Stored VS Code secrets keyed under `dev.continue.continue` are invalidated by the rename — users must re-authenticate after upgrade. This is acceptable for a fresh fork and documented here.
4. Renaming the JetBrains plugin id breaks updates for existing Continue users (treated as a new plugin) — expected.
5. Vendored third-party code under `core/vendor/` and `manual-testing-sandbox/` is **not** renamed.

## Migration

`~/.continue/` is **not** migrated automatically on the first run. The CLI and VS Code activation prompt the user once — opt in copies the directory to `~/.yutoagentic/` and writes a `.migrated_from_continue` marker so the prompt does not reappear.
