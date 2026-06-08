# Build Dependencies & Secrets

This document catalogs all build dependencies, secrets, and environment variables required by the continue-fork repository.

---

## VS Code Extension

| Secret               | Purpose                                                                             | Referenced In               |
| -------------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| `VSCE_TOKEN`         | Personal access token for publishing to the VS Code Marketplace (set as `VSCE_PAT`) | `main.yaml`, `preview.yaml` |
| `VSX_REGISTRY_TOKEN` | Token for publishing to the Open VSX Registry                                       | `main.yaml`, `preview.yaml` |

---

## JetBrains Extension

| Secret                           | Purpose                                                               | Referenced In            |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| `APPLE_CERT_DATA`                | Base64-encoded Apple signing certificate (p12) for macOS code signing | `jetbrains-release.yaml` |
| `APPLE_CERT_PASSWORD`            | Password for the Apple signing certificate                            | `jetbrains-release.yaml` |
| `APPLE_NOTARY_USER`              | Apple notarization username (currently commented out)                 | `jetbrains-release.yaml` |
| `APPLE_NOTARY_PASSWORD`          | Apple notarization password (currently commented out)                 | `jetbrains-release.yaml` |
| `JETBRAINS_PUBLISH_TOKEN`        | Token for publishing to JetBrains Marketplace                         | `jetbrains-release.yaml` |
| `JETBRAINS_CERTIFICATE_CHAIN`    | Certificate chain for signing the JetBrains plugin                    | `jetbrains-release.yaml` |
| `JETBRAINS_PRIVATE_KEY`          | Private key for signing the JetBrains plugin                          | `jetbrains-release.yaml` |
| `JETBRAINS_PRIVATE_KEY_PASSWORD` | Password for the JetBrains signing private key                        | `jetbrains-release.yaml` |

---

## CLI

| Variable            | Purpose                                                                 | Referenced In                                                                                      |
| ------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `CONTINUE_API_BASE` | Base URL for the Continue API (defaults to `https://api.continue.dev/`) | `extensions/cli/.env.example`                                                                      |
| `CONTINUE_API_KEY`  | API key for Continue authentication                                     | `extensions/cli/.env.example`, `packages/continue-sdk/typescript/.env.example`, multiple workflows |

---

## NPM Package Releases

| Secret                          | Purpose                                                     | Referenced In                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `SEMANTIC_RELEASE_GITHUB_TOKEN` | GitHub token used by semantic-release for creating releases | `release-openai-adapters.yml`, `release-config-yaml.yml`, `release-fetch.yml`, `release-llm-info.yml`, `reusable-release.yml` |
| `SEMANTIC_RELEASE_NPM_TOKEN`    | npm token used by semantic-release for publishing packages  | `release-openai-adapters.yml`, `release-config-yaml.yml`, `release-fetch.yml`, `release-llm-info.yml`, `reusable-release.yml` |
| `SEMANTIC_RELEASE_TOKEN`        | GitHub token for stable release workflow                    | `stable-release.yml`                                                                                                          |

---

## AI Provider API Keys (Testing & Releases)

Used for integration tests in PR checks and package releases.

| Secret                                | Purpose                                | Referenced In                                                                                         |
| ------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                      | OpenAI API key                         | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `ANTHROPIC_API_KEY`                   | Anthropic API key                      | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`, `cli-pr-checks.yml`, `continue-agents.yml` |
| `GEMINI_API_KEY`                      | Google Gemini API key                  | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `MISTRAL_API_KEY`                     | Mistral API key                        | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `AZURE_OPENAI_API_KEY`                | Azure OpenAI API key                   | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `AZURE_FOUNDRY_CODESTRAL_API_KEY`     | Azure AI Foundry Codestral API key     | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `AZURE_FOUNDRY_MISTRAL_SMALL_API_KEY` | Azure AI Foundry Mistral Small API key | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `AZURE_OPENAI_GPT41_API_KEY`          | Azure OpenAI GPT-4.1 API key           | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `VOYAGE_API_KEY`                      | Voyage AI embeddings API key           | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `RELACE_API_KEY`                      | Relace API key                         | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |
| `INCEPTION_API_KEY`                   | Inception API key                      | `pr-checks.yaml`, `reusable-release.yml`, `release-*.yml`                                             |

---

## CI/CD & GitHub

| Secret             | Purpose                                                         | Referenced In                                                                                                         |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`     | Default GitHub Actions token (automatic)                        | Many workflows                                                                                                        |
| `CI_GITHUB_TOKEN`  | Elevated GitHub PAT for cross-repo operations and PR management | `jetbrains-release.yaml`, `preview.yaml`, `main.yaml`, `pr-checks.yaml`, `auto-assign-issue.yaml`                     |
| `CONTINUE_API_KEY` | Continue platform API key for agent workflows                   | `run-continue-agent.yml`, `tidy-up-codebase.yml`, `snyk-agent.yaml`, `auto-fix-failed-tests.yml`, `cli-pr-checks.yml` |
| `RUNLOOP_API_KEY`  | Runloop API key for uploading sandbox blueprints                | `stable-release.yml`, `upload-runloop-blueprint.yml`                                                                  |
| `SNYK_TOKEN`       | Snyk security scanning token                                    | `snyk-agent.yaml`                                                                                                     |

---

## Issue/PR Tooling

| Secret                               | Purpose                                              | Referenced In        |
| ------------------------------------ | ---------------------------------------------------- | -------------------- |
| `CHROMA_CLOUD_API_KEY`               | Chroma vector DB API key for similar issue detection | `similar-issues.yml` |
| `CHROMA_TENANT`                      | Chroma tenant identifier                             | `similar-issues.yml` |
| `CHROMA_DATABASE`                    | Chroma database name                                 | `similar-issues.yml` |
| `ISSUE_PR_METRICS_SLACK_WEBHOOK_URL` | Slack webhook for PR/issue metrics notifications     | `metrics.yaml`       |

---

## SSH Testing

| Secret                         | Purpose                                     | Referenced In    |
| ------------------------------ | ------------------------------------------- | ---------------- |
| `GH_ACTIONS_SSH_TEST_KEY_PEM`  | SSH private key for remote connection tests | `pr-checks.yaml` |
| `GH_ACTIONS_SSH_TEST_DNS_NAME` | DNS name of the SSH test host               | `pr-checks.yaml` |

---

All workflow files are located under `.github/workflows/`. Environment example files are at:

- `extensions/cli/.env.example`
- `packages/continue-sdk/typescript/.env.example`
