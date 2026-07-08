# PR #2 Testing Checklist — Strip Hub/Mission Control Code

## Critical

- [x] **Extension cold start** — Launch VS Code with the extension. No errors in Output panel ("Continue" channel) or Dev Tools console. _(Found and fixed `message.includes` crash in `webviewProtocol.ts` + removed dead proxy-server error handling block.)_
- [x] **Fresh install onboarding** — Delete/rename `~/.continue/config.yaml`, restart. Onboarding card shows "Configure your models" (no Hub sign-in). _(Removed "Credits" tab, fixed Ollama link padding, title font sizes, and "Google Gemini API API key" duplicate.)_
- [x] **Existing config loads** — With existing `config.yaml`, models/context providers/MCP servers all load.
- [x] **API key resolution from `.env`** — Models using secrets from `~/.continue/.env` or workspace `.env` authenticate and respond.
- [x] **Config reload** — Edit `config.yaml` while running, changes picked up without restart.

## High Priority

- [x] **Profile/assistant switching** — Assistant dropdown shows only local profiles. Switching works. _(Fixed missing profiles list in GUI by adding `profiles` to configUpdate message. Also fixed initial Redux state label and adjusted dropdown styling.)_
- [x] **Compilation** — `tsc --noEmit` passes for core, GUI, and VS Code extension.
- [x] **Test suite** — Vitest tests pass: `LocalPlatformClient` (8), `LocalProfileLoader` (2), `doLoadConfig` (2) — all 12 pass.
- [x] **No telemetry network calls** — Dev Tools Network tab shows no requests to `posthog.com` or `sentry.io`.
- [x] **Agent mode tools** — Start an agent conversation, all tools load correctly.

## Medium Priority

- [x] **MCP servers connect** — Configured MCP servers connect and tools appear.
- [x] **Local blocks in YAML** — Local model block files in `.continue/models/` auto-merge into config correctly.
- [x] **Background mode view** — N/A, component removed from UI routing. No way to navigate to it.
- [x] **Keyboard shortcut `Cmd+Shift+'`** — Toggles between configs without errors.
- [x] **Config settings page** — Settings page renders cleanly, no Account dropdown or Organizations tab. _(Removed GitHub issue/community links.)_

## Low Priority

- [x] **"Main Config" naming** — Fresh installs show "Main Config" as default profile name.
- [x] **IntelliJ startup** — Profiles load correctly after rebuilding core binary. _(Core binary must be rebuilt for IntelliJ to pick up changes.)_
