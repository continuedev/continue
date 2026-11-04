# Plan: Maintained fork of Continue with working MCP OAuth and enterprise TLS

Status: **in progress; see [`ROADMAP.md`](./ROADMAP.md) for what has shipped and what is next.** Written 2026-10-27 as the original design record; the sections below are left as written and were not re-audited against the code that has since merged. The fork `https://github.com/b1tninja/continued` now contains the work listed in the roadmap. Sections 8-11 define done, CI/CD, licensing and supporting work.

## 1. Why

`continuedev/continue` is read-only and no longer maintained (README note; final release is VS Code extension 2.0.0, the version installed here). We use it with AWS Bedrock models and remote MCP servers (Datadog, Atlassian, Wiz) behind an enterprise TLS-inspecting proxy. Three gaps block that, and upstream will not fix them:

| #   | Gap                                                                                                                                                                                                   | Evidence                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MCP OAuth tokens are only attached to `type: sse` servers. `streamable-http` servers complete sign-in but then connect with no `Authorization` header and fail with `Unauthorized`.                   | `core/context/mcp/MCPConnection.ts`, `connectClient()`: the comment "currently support oauth for sse transports only" guards the `getOauthToken()` call.                                  |
| 2   | The "Authenticate" button only appears when the connection error contains `401` or `Unauthorized`. Servers that answer `invalid_token` (Atlassian) or `Invalid or expired token` (Wiz) never show it. | `is401Error()` in `MCPConnection.ts`.                                                                                                                                                     |
| 3   | No way to use the OS trust store. MCP transports and OAuth discovery run on Node's built-in CA list, so proxy-signed endpoints fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.                         | Reproduced with `node -e fetch(...)`; fixed by `NODE_OPTIONS=--use-system-ca`. `packages/fetch/src/certs.ts` builds CA lists from `tls.rootCertificates` plus `NODE_EXTRA_CA_CERTS` only. |

Current workaround: run each server through `mcp-remote@0.15.2` as a `stdio` entry with `NODE_OPTIONS: --use-system-ca`. It works but is an extra moving part per server.

## 2. Decision to make first: fork or switch

Before committing to a fork, check whether a maintained client already covers this:

- **Cline** (already installed): all three servers authenticate natively. The gap is only that Continue-specific features (edit/apply roles, autocomplete) work differently.
- **Roo Code / Kilo Code** (Cline forks): not evaluated. Check release cadence, Bedrock API-key support, and TLS-inspection behaviour.
- **Fork Continue**: full control, but we own a large TypeScript monorepo (VS Code extension, JetBrains plugin, CLI, GUI).

Recommendation: spend half a day evaluating Roo Code and Kilo Code first. Fork only if none work. If forking, **scope to the VS Code extension only**; do not carry the JetBrains plugin or CLI.

## 3. Scope

In scope:

1. MCP OAuth for `streamable-http` (and keep it for `sse`).
2. A reliable "sign in" trigger for any 401-like failure, plus a manual "Authenticate" action.
3. System-trust-store support for MCP transports, OAuth discovery/token calls, and model requests.
4. Config options exposing the above (YAML), and tests.
5. Bedrock and Mantle as first-class providers, and separate model choice per mode (Plan / Agent / Chat), modelled on Cline's Plan/Act setup (section 4.7).

Out of scope: JetBrains plugin, CLI, hub/auth features (already removed upstream in 2.0.0), model providers other than Bedrock and Mantle, upstreaming.

## 4. Work breakdown

### 4.1 Repo setup (about 0.5 day)

- Done 2026-10-27: forked to `b1tninja/continued` (public, a GitHub fork of `continuedev/continue`, default branch `main`), cloned to `C:\github\b1tninja\continued`, `upstream` remote added. Next: branch from the `v2.0.0-vscode` tag (section 11, item 1) and change the VS Code publisher and extension ID so it cannot collide with, or be auto-updated by, the original marketplace listing. Ownership of the repo is an open question (section 10).
- Follow `BUILD_DEPENDENCIES.md` and `CONTRIBUTING.md` to build `extensions/vscode` and produce a `.vsix`. Confirm a clean build on Windows with the proxy root installed.
- Disable or remove telemetry, auto-update, and marketplace publishing workflows in `.github/`.
- Decide on distribution: internal `.vsix` file share vs. private marketplace. Document how users install and update.

### 4.2 Gap 1: OAuth on streamable-http (about 1-2 days)

Files: `core/context/mcp/MCPConnection.ts`, `core/context/mcp/MCPOauth.ts`.

- In `connectClient()`, change the `if (this.options.type === "sse")` guard so it applies to both `sse` and `streamable-http`. Also handle the case where `type` is omitted (the code tries HTTP first, then falls back to SSE).
- Prefer the MCP SDK's native `authProvider` option on `StreamableHTTPClientTransport` and `SSEClientTransport` instead of hand-copying a bearer header. The SDK then handles 401, discovery, refresh and token expiry. `MCPConnectionOauthProvider` already implements `OAuthClientProvider`, so wiring it in is small.
- Tokens expire (Datadog issues 3600 s tokens). Verify refresh-token use and that a refreshed token is saved back through `saveTokens()`.
- `mcpOauthStorage` is keyed by server URL. Clear the stored entry when a sign-in fails, so stale state does not repeat the problem seen on 2026-10-27 (a leftover token, client registration and PKCE verifier).

### 4.3 Gap 2: sign-in trigger (about 0.5-1 day)

Files: `MCPConnection.ts` (`is401Error`), the GUI MCP server list (search `isProtectedResource` in `gui/src`), protocol messages `mcp/startAuthentication` and `mcp/removeAuthentication` in `core/protocol/core.ts`, handlers in `core/core.ts`.

- Treat HTTP 401 as "needs auth" regardless of body text. Best signal is the status code or a `WWW-Authenticate: Bearer` header on the transport error, not string matching on the message.
- Add an always-available "Sign in / Sign out" action per remote server, so a user is never left without a button.
- Show the real error and the callback URL in use.

### 4.4 Gap 3: system CA support (about 1-2 days)

Files: `packages/fetch/src/certs.ts`, `packages/fetch/src/getAgentOptions.ts`, `MCPConnection.ts` (transports), `MCPOauth.ts` (the SDK's discovery and token fetches).

- Add a request option, for example `useSystemCa: true` (default on for Windows and macOS), to `requestOptionsSchema` in `packages/config-yaml/src/schemas/models.ts`, next to `caBundlePath`, `verifySsl` and `clientCertificate`. Update `packages/config-types` as well.
- Implementation: Node 22+ exposes the OS store through `tls.getCACertificates('system')` (the in-process equivalent of `--use-system-ca`). Merge the result into `CertsCache.fixedCa`. Check which Node version VS Code's extension host runs, and keep a fallback loader if the API is missing.
- Apply the resulting agent to every network path. Today `StreamableHTTPClientTransport` gets only `requestInit.headers` and an optional insecure agent:
  - Streamable HTTP and SSE transports (pass a custom `fetch` or dispatcher built from `getAgentOptions`).
  - OAuth discovery, dynamic client registration, code exchange and refresh. The SDK uses `fetch` internally, so supply a custom fetch function wherever its auth helpers allow it.
  - `stdio` transports: set `NODE_OPTIONS=--use-system-ca` in the child environment by default, so `npx`-launched servers also trust the proxy CA.
- Make `mcpServers[].requestOptions` honour `caBundlePath`, `verifySsl` and `useSystemCa`. The schema already allows `requestOptions` on SSE and HTTP servers, but the code only reads `verifySsl` and `headers`.

### 4.5 Config surface (about 0.5 day)

Document in the fork's README:

```yaml
mcpServers:
  - name: Datadog
    type: streamable-http
    url: https://mcp.datadoghq.eu/api/unstable/mcp-server/mcp
    requestOptions:
      useSystemCa: true
```

OAuth sign-in would be automatic on a 401. Optional extra: a configurable OAuth callback port instead of the fixed `3000` (`PORT` in `MCPOauth.ts`), because a fixed port can clash and some providers register only one redirect URI.

### 4.6 Tests and validation (about 1-2 days)

- Unit tests for `MCPConnection` and `MCPOauth` against a mock MCP server that demands a bearer token and returns 401 with and without a `WWW-Authenticate` header.
- A local mock OAuth authorization server (dynamic registration, PKCE, refresh) to test the whole flow end to end.
- A TLS test using a locally generated CA that is trusted only through the OS store (or `NODE_EXTRA_CA_CERTS`) to prove `useSystemCa` works and that it fails when disabled.
- Manual acceptance on a TLS-inspected machine against the real servers, with no `mcp-remote` involved:
  - Datadog (EU): connects, lists tools, and survives a token refresh (wait more than an hour).
  - Atlassian: `https://mcp.atlassian.com/v1/mcp/authv2` today. Plan a move to `/v2/mcp` before Atlassian's stated v1 cut-off of 2027-03-01.
  - Wiz: `https://mcp.app.wiz.io`.

### 4.7 Bedrock, Mantle and per-mode models (about 3-5 days)

Goal: the model setup we have today in Cline, available in the fork as first-class config.

What exists upstream, from reading `core/llm/llms/Bedrock.ts` on `main`:

- A `bedrock` provider using `BedrockRuntimeClient` with the `ConverseStream` and `InvokeModel` commands.
- Bedrock API-key (bearer token) auth, long-term access keys, and `fromNodeProviderChain` with a named `profile` (default `bedrock`).
- Reasoning (`thinking` with `budget_tokens`) and prompt caching through `defaultCompletionOptions.promptCaching`.
- The endpoint is built as `https://bedrock-runtime.<region>.amazonaws.com`, with no way to override it.
- There is no Mantle support. Mantle is a separate endpoint family (`bedrock-mantle.<region>.api.aws`) serving OpenAI-compatible and Anthropic Messages APIs, with a model-specific path prefix (`/v1` for most models, `/openai/v1` for some such as `openai.gpt-daybreak-blue-5.6-sol`). Today we reach it only through the generic `openai` provider with a hand-typed `apiBase`.

Also confirmed in the types (`core/index.d.ts`): modes are `"chat" | "agent" | "plan" | "background"`, but model selection is per **role** (`selectedModelByRole`), and Plan mode only restricts tools. The Plan mode docs describe it as read-only tools with no per-mode model choice. So there is no way to use Opus to plan and Sonnet to act.

Work items:

1. **Per-mode model selection (Plan / Agent / Chat).**
   - Add a mode-to-model mapping, in `config.yaml`, e.g.
     ```yaml
     modeModels:
       plan: { model: Claude Opus 5.5 (Bedrock), reasoningEffort: medium }
       agent: { model: Claude Sonnet 5.5 (Bedrock), reasoningEffort: low }
       chat: { model: Claude Haiku 5.5 (Bedrock) }
     ```
   - Resolve the active model from the current `MessageModes` value instead of only `selectedModelByRole.chat`. Switching mode switches the model, and the model picker shows which one each mode uses. Keep a manual override for the session.
   - This mirrors Cline's Plan/Act setup (`planModeApiModelId`, `actModeApiModelId`, `planActSeparateModelsSetting`, per-mode reasoning effort). Cline's own docs describe using different models per mode.
   - Files to inspect first: wherever `selectedModelByRole` is read in `core/` and `gui/` (the chat request path), the mode selector in `gui/`, and the `ConfigYaml` schema in `packages/config-yaml`.

2. **Bedrock provider improvements** (`core/llm/llms/Bedrock.ts`):
   - Endpoint override (`apiBase`), so a VPC/PrivateLink or custom endpoint works.
   - Honour `requestOptions` (`caBundlePath`, `useSystemCa`, `proxy`, `noProxy`) by passing a custom `requestHandler` to `BedrockRuntimeClient`. It currently ignores them, which would also break under TLS inspection.
   - Reasoning effort (`low | medium | high`) as an option, not only a raw token budget, because Cline exposes it per mode and our newer models use it.
   - Cross-region inference profile helper: accept a short model name and add the `us.` or `global.` prefix from a `crossRegion` setting, or validate the prefix against `ListInferenceProfiles`.
   - Model discovery: list the profiles the key can use (as done manually during setup on 2026-10-27) and populate the model picker, so IDs are not hand-typed.
   - Clearer error text for `AccessDenied` (for example the explicit-deny policy seen on `us.openai.gpt-daybreak-blue-5.6-sol`).

3. **New `bedrock-mantle` provider.**
   - Reuse the OpenAI-compatible client with: region setting, Bedrock API key as the bearer token, and the correct base URL built from region plus a per-model path prefix (`/v1` or `/openai/v1`). Allow a manual prefix override because AWS documents that it varies by model.
   - List models from `GET <base>/v1/models` for discovery. We verified this returns the catalog; `/openai/v1/models` returned 404.
   - Handle model quirks. A test call on 2026-10-27 showed Daybreak Blue rejects `max_tokens` ("Unsupported parameter: 'max_tokens' is not supported with this model"). The replacement is probably OpenAI's `max_completion_tokens`, but that was not tested. Make the token-limit parameter name a per-model capability flag and verify it against the live model.
   - Apply the same TLS options as 4.4.
   - Optionally support the Anthropic Messages API on Mantle for Claude models.

4. **Other Cline-style conveniences worth considering** (each optional, ranked by value):
   - Auto-approve tool policies with per-tool "ask / allow / deny" (Continue already has per-tool policies in the Tools panel; extend to MCP tools and add a global YOLO toggle). Now tracked as Track B in `ROADMAP.md`.
   - Checkpoints for file edits, so an Agent run can be rolled back.
   - A `.continuerules`-style global rules toggle per mode.
   - Context-window and cost display per model, using the pricing seen on OpenRouter as a reference.
   - Import of Cline's MCP settings file (`cline_mcp_settings.json`) so servers do not have to be configured twice.

Acceptance:

- Switching from Plan to Agent switches from Opus to Sonnet without touching the picker, with the reasoning effort set per mode.
- Bedrock Claude models and a Mantle model both work with only an API key and a region in the YAML, under TLS inspection, with no proxy tooling.
- The model picker lists models discovered from the account instead of typed IDs.

## 5. Estimate and risks

Total: roughly **9-14 working days** for one engineer familiar with TypeScript and the VS Code extension model (sections 4.1-4.6 about 6-9 days, section 4.7 about 3-5 days). This is a rough estimate; I did not build the project to measure it. Section 4.7 is the most uncertain, because the per-mode model change touches the chat request path and the GUI, which I only read at the type level.

| Risk                                                                                   | Mitigation                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Large unfamiliar codebase, slow builds                                                 | Scope to `extensions/vscode`; get a green build before any change.            |
| `tls.getCACertificates` unavailable in the extension host's Node version               | Check VS Code's Node version up front; keep a fallback loader.                |
| The pinned MCP SDK version may lack `authProvider` or custom fetch hooks               | Check the pinned `@modelcontextprotocol/sdk` version; budget for an SDK bump. |
| Vendors reject Continue's dynamic client registration or the `localhost:3000` redirect | Test early with each real server; add the configurable callback port.         |
| Maintenance burden of a fork nobody upstream supports                                  | Keep the diff small (about 5 files); document how to rebase; name an owner.   |
| Marketplace or identity collision with the original extension                          | Change the extension ID and publisher in `package.json`.                      |

## 6. Open questions

1. Is there an approved internal channel to distribute a self-built `.vsix`?
2. May the fork be public, or must it stay private?
3. Should Bedrock settings (API key, region) get UI support, or stay YAML-only as they are today?
4. Who owns the fork long term?

## 7. Interim setup (works today, no fork)

- `%USERPROFILE%\.continue\mcpServers\remote-mcp.yaml` runs Atlassian, Datadog and Wiz through `mcp-remote@0.15.2` as `stdio` servers, each with `NODE_OPTIONS: --use-system-ca`.
- The Windows user environment variable `NODE_OPTIONS=--use-system-ca` is also set.
- Models live in `%USERPROFILE%\.continue\config.yaml`: Bedrock Claude Sonnet, Opus and Haiku 5.5, Kimi K3, and the Mantle OpenAI-compatible endpoint for Daybreak Blue.

## 8. Definition of done

The fork is done when every box below is checked. Each group can be verified on its own.

### 8.1 Functional (verified on a machine behind a TLS-inspecting proxy)

Start state: stock VS Code, the built `.vsix`, a `config.yaml`, and the proxy root certificate in the OS trust store. No `NODE_OPTIONS`, no `NODE_EXTRA_CA_CERTS`, no `mcp-remote`, no other proxy tooling.

- [ ] Three real remote MCP servers connect, complete OAuth once, list tools and run one tool: one plain `streamable-http` server, one that answers 401 with `invalid_token`, and one that answers 401 with other body text.
- [ ] After quitting and reopening VS Code, the servers are still connected with no new sign-in.
- [ ] An expired access token is refreshed without prompting (use a server with short-lived tokens and wait past expiry).
- [ ] A revoked refresh token produces a clear "sign in again" state, with no retry loop and no stale stored state.
- [ ] `sse` servers still work.
- [ ] A Bedrock Claude model (API key plus region) and a Mantle model each stream a chat reply, also under inspection.
- [ ] Switching from Plan to Agent mode changes the model and reasoning effort, and the UI shows which model each mode uses.
- [ ] The model picker is populated from the account, not typed IDs.
- [ ] Failures name the cause: untrusted certificate, redirect rejected, callback port busy, access denied.

### 8.2 Quality gates

- [ ] Baseline recorded: upstream's own tests (core, gui, packages, vscode) run on the unchanged base and the known failures are listed in `BASELINE.md`.
- [ ] New code has tests: mock MCP server, mock OAuth server, TLS test with a locally generated CA, request-shape tests for Bedrock and Mantle with mocked HTTP.
- [ ] No regression against the baseline; `tsc:check`, eslint and prettier are clean in CI.
- [ ] Runtime egress check: with the default config the extension contacts only hosts the user configured. Attach the captured host list to the release.
- [ ] MCP OAuth tokens live in VS Code SecretStorage, not plaintext in `~/.continue/index/globalContext.json` (section 11).

### 8.3 Release

- [ ] Pushing a version tag builds a `.vsix` for win32-x64, linux-x64 and darwin-arm64, with `SHA256SUMS`, an SBOM and a build provenance attestation, and publishes a GitHub Release with a changelog.
- [ ] The `.vsix` installs on a clean VS Code profile with `code --install-extension`, shows our name and icon, and coexists with the original Continue extension without command or view conflicts.
- [ ] `gh attestation verify` passes for the released files.

### 8.4 Docs and ownership

- [ ] README (what it is, why, "unofficial fork" notice, install), config reference for the new options, troubleshooting, migration from Continue, `NOTICE`, `CHANGELOG.md`.
- [ ] A named owner, a security contact in `SECURITY.md`, branch protection on `main`, Dependabot, CodeQL and secret scanning enabled.

## 9. CI/CD and packaging

### 9.1 What upstream already has (read from the fork at `main`)

- Composite action `.github/actions/build-vscode-extension`: `setup-node` from `.nvmrc` (20.20.1), per-directory `node_modules` caches, `node ./scripts/build-packages.js`, `npm ci` in `extensions/vscode`, `gui` and `core`, a GUI build with a 4 GB heap, `npm run prepackage -- --target <t>`, `npm run package -- --target <t>`, then `npx vsce package --no-dependencies --target <t>` (with `--pre-release` when requested).
- `pr-build-upload-vsix.yaml`: a matrix of `linux-x64` (ubuntu), `win32-x64` (windows) and `darwin-arm64` (macos), 10-minute timeout, uploads the build directory and the `.vsix`.
- `pr-checks.yaml`: prettier, checks for core, gui, binary, vscode and packages, e2e jobs, JetBrains tests, and an `alls-green` gate job.
- `vscode-prerelease.yml`: manual dispatch that bumps the version on a new branch. Publishing used the `VSCE_TOKEN` and `VSX_REGISTRY_TOKEN` secrets.
- 33 files in `.github/workflows`. Many reference secrets we will not have (Apple signing, JetBrains, Runloop, Snyk, a Slack webhook, LLM provider keys). `cla.yaml` runs on `pull_request_target`.
- Repo also has `CODEOWNERS`, `dependabot.yml`, issue and PR templates.

### 9.2 What to keep, trim and remove

Decided from file names only. Read each file before deleting it.

| Action        | Files                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep and trim | `pr-checks.yaml` (drop JetBrains, CLI, Runloop and rerun-tracking jobs), `pr-build-upload-vsix.yaml`, composite actions `build-vscode-extension`, `setup-component`, `setup-packages`, `run-vscode-e2e-test`, `dependabot.yml`                                                                                                                                                                                                           |
| Remove        | `jetbrains-release`, `run-continue-agent`, `continue-agents`, `runloop-*`, `upload-runloop-blueprint`, `snyk-agent`, `metrics`, `similar-issues`, `auto-assign-issue`, `auto-fix-failed-tests`, `tidy-up-codebase`, `cla.yaml`, `docs-gh-pages`, `stable-release`, `release-*` (npm packages), `label-merged-prs`, `stale-issue-helper`, `delete-stale-branches`, `preview`, `main.yaml`, `main-build.yaml` unless read and found useful |

### 9.3 New workflows

| File                    | Trigger                       | What it does                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                | pull request, push to `main`  | Format, lint and `tsc:check`; unit tests for core, gui, packages and vscode; one smoke build of the `.vsix` on Linux; a single required `gate` job for branch protection.                                                                    |
| `build-vsix.yml`        | `workflow_call`               | Reusable build matrix (win32-x64, linux-x64, darwin-arm64 to start; add arm64 targets when needed). Native modules (sqlite, onnx, lancedb, ripgrep, esbuild) are per-platform, so each target builds on its own runner. Uploads the `.vsix`. |
| `release.yml`           | tag `v*` (or manual dispatch) | Calls `build-vsix.yml`, generates `SHA256SUMS` and an SBOM, creates a build provenance attestation, publishes a GitHub Release. Marketplace publishing is a separate job behind a protected environment.                                     |
| `codeql.yml`            | PR, weekly                    | CodeQL for JavaScript/TypeScript.                                                                                                                                                                                                            |
| `dependency-review.yml` | PR                            | Fails PRs that add vulnerable or disallowed-license dependencies.                                                                                                                                                                            |

### 9.4 Practices to apply

- Pin third-party actions to full commit SHAs. Upstream uses tags and some branches (`jlumbroso/free-disk-space@main`, `re-actors/alls-green@release/v1`).
- Set `permissions: contents: read` at workflow level and widen per job only where needed. Set `persist-credentials: false` on checkout.
- Never check out PR code under `pull_request_target`.
- Keep release secrets in a protected GitHub Environment with a required reviewer. Prefer OIDC and attestations over long-lived tokens where the target supports them.
- Use `concurrency` to cancel superseded PR runs. Set `timeout-minutes` on every job.
- Cache npm through `actions/setup-node` with `cache-dependency-path` for each lockfile, instead of caching `node_modules` directories, which can go stale.
- Keep the Node version in one place (`.nvmrc`), and build the `.vsix` with `npm ci`, not `npm install`.
- Dependabot for `github-actions` and `npm`, grouped weekly, so a dead upstream does not leave us on stale dependencies.
- Branch protection (or a ruleset) on `main`: require the `gate` job, require review, block force pushes.

## 10. License and compliance

What the fork contains (checked in `b1tninja/continued` at `main`, which GitHub reports as Apache License 2.0):

| Item                                      | Finding                                                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `LICENSE`                                 | Apache License 2.0, copyright line "Copyright 2023 Continue Dev, Inc."                                                                         |
| `extensions/vscode/LICENSE.txt`           | Apache 2.0 notice, "Copyright 2023 Continue". Not byte-identical to the root file. Ships inside the `.vsix`.                                   |
| `NOTICE`                                  | None exists upstream.                                                                                                                          |
| `gui/public/fonts/Inter/LICENSE.txt`      | Inter font under the SIL Open Font License 1.1. Keep the license file with the font.                                                           |
| `CLA.md` and `.github/workflows/cla.yaml` | Upstream's CLA grants rights to Continue Dev, Inc. for contributions made to the upstream project. It does not bind our fork.                  |
| Dependencies                              | Not audited. Hundreds of npm packages plus native binaries (ripgrep, sqlite, onnx runtime, lancedb). Needs a generated inventory (section 11). |

Conclusion: the license permits forking, modifying and redistributing, including commercially, with conditions. I am not a lawyer, so treat this as a checklist for review and not legal advice.

Apache 2.0 conditions that apply to us:

- [ ] Keep `LICENSE` and ship a copy with every distribution (the `.vsix` already contains `LICENSE.txt`; keep it).
- [ ] Keep all existing copyright, patent, trademark and attribution notices in source files.
- [ ] Mark modified files as changed. Cheapest approach: a `NOTICE` file stating "This is an unofficial fork of Continue, modified by ...", with the change list kept in `CHANGELOG.md` and git history. Decide whether to also add a per-file header; that choice belongs to whoever owns the fork.
- [ ] Add a copyright line for our own modifications in `NOTICE` and in new files. The holder must be settled first.
- [ ] No trademark rights are granted (Apache section 6). Do not use the "Continue" name or logo as ours. Rename the extension, replace `media/icon.png` and `media/sidebar-icon.png`, and say "unofficial fork, not affiliated with Continue Dev, Inc." in the README and the Marketplace description. The name "Continued" is close to "Continue", so keep the disclaimer prominent and consider a more distinct name if this is ever published widely.
- [ ] Inbound contributions to our repo are under Apache 2.0 by default (Apache section 5). Remove `cla.yaml`, or replace it with a DCO check if outside contributors are expected.
- [ ] Reproduce third-party notices: generate a `THIRD_PARTY_NOTICES.md` from the npm tree and the bundled binaries, and include it in the `.vsix`.
- [ ] Keep the Inter font license next to the font files.

Ownership, IP and visibility questions are tracked outside this repository.

## 11. Supporting work and best practice

1. **Base version.** Upstream has three candidates: the `v2.0.0-vscode` tag (GitHub release, not a pre-release; the version the README calls final and the one installed locally), the `v2.1.0-vscode` tag (published as a pre-release; the only difference from 2.0.0 is the version in `package.json` and the lockfile), and `main` (diverged from 2.1.0: it has 3 docs-only commits, the last on 2026-07-21, and lacks the 2.1.0 version-bump commit). Recommended base: `v2.0.0-vscode`, because it is the released version and the code matches 2.1.0 anyway. The MCP SDK range is `^1.25.2` at both tags. Take `main` only if the docs commits turn out to matter.
2. **Branching.** Keep `main` as our integration branch and a read-only `upstream-base` branch at the chosen tag. The `upstream` remote already points at `continuedev/continue`. Do all work on short-lived feature branches merged by PR, with one concern per PR (OAuth, sign-in trigger, CA, Bedrock, Mantle, modes) so each can be reverted.
3. **Slim the tree.** `extensions/cli` (477 files), `extensions/intellij` (124 files) and `docs` (419 files) are out of scope. Delete them in one dedicated commit so the diff against upstream stays readable, and keep `git log` clean of mixed changes.
4. **Identity changes** (`extensions/vscode/package.json`): `name`, `displayName`, `publisher`, `description`, `icon`, `repository`, `bugs`, `homepage`, `galleryBanner`. Upstream's manifest declares 76 `continue.*` command IDs and 5 view/container IDs. Decide once whether to rename them. Keeping them means our extension and the original cannot run side by side; renaming them is a large mechanical change. Recommended: keep the IDs, document that the original must be uninstalled, and have the extension warn on activation if both are present.
5. **Telemetry and network egress.** The manifest still has the deprecated `continue.telemetryEnabled` setting and `VsCodeIde.isTelemetryEnabled()` reads it. Upstream says it removed anonymous telemetry in 2.0.0, but that is the release note's claim, not something I verified in the code. Verify it by capturing traffic from a fresh install, and record the allowed hosts as a test. Remove the setting, the auto-update check, and anything that calls `continue.dev` or other upstream hosts at runtime.
6. **Secrets handling.** OAuth tokens, client registrations and PKCE verifiers are stored in `~/.continue/index/globalContext.json` under `mcpOauthStorage` (see `MCPOauth.ts`, lines 137-149). That file is plaintext. The VS Code extension already has a `SecretStorage` wrapper (`extensions/vscode/src/stubs/SecretStorage.ts`, used by `VsCodeIde.ts`). Move MCP OAuth data there, with a one-time migration that deletes the old plaintext entries. Also stop writing API keys into logs and error messages.
7. **Supply chain.** Commit lockfiles. Run `npm ci` only. Enable `npm audit` in CI, Dependabot, and dependency review. Verify the checksums of anything downloaded at build time (ripgrep, the ONNX model assets, Chromedriver in e2e). Generate an SBOM (`anchore/sbom-action` or `cyclonedx-npm`). Record `vsce` and `@vscode/vsce` versions used to package.
8. **Testing strategy.** Run upstream's suite first on the untouched base and record failures, so later regressions are attributable (section 8.2). Prefer unit tests with mock servers in CI; keep live-vendor tests manual and out of CI, since they need real credentials and a TLS-inspecting network.
9. **Repository hygiene.** Add `CODEOWNERS` with the named owner, rewrite `SECURITY.md` with our contact (upstream's points at Continue), set `CONTRIBUTING.md` to the real process, disable Discussions and Wikis if unused, and enable private vulnerability reporting.
10. **Staying current.** Upstream is frozen, so rebasing is not the problem; dependency drift is. Schedule a monthly job: Dependabot PRs, a check of the MCP SDK changelog (auth fixes land there), and a check of the Bedrock and Mantle docs for new model prefixes and parameters. Re-run section 8.1 after every dependency bump to a major version.
11. **Release process.** Semantic versions beginning at `0.1.0` (not continuing upstream's 2.x line, which would suggest official status). Tag `vX.Y.Z`; `release.yml` builds, attests and publishes. `CHANGELOG.md` follows Keep a Changelog. Pre-releases use `-rc.N` and the `--pre-release` flag of `vsce`.
12. **Distribution.** Start with GitHub Releases plus `code --install-extension <file>.vsix`. VS Code does not auto-update side-loaded `.vsix` files, so document how to check for and install a new release. Publishing to the Marketplace or Open VSX needs a publisher account and a token held in a protected environment. Decide this later (section 6, question 1).
