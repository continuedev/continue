# Patch: wire `config.ts` into the `config.yaml` loading pipeline

Branch: `fix/config-ts-yaml-pipeline`
Base: `main` @ `18acf6fc26b`
Files touched: `core/config/load.ts`, `core/config/yaml/loadYaml.ts`

## Problem

`config.ts` (`modifyConfig()`) is documented as a way to programmatically
customize the final Continue config — add custom context providers, set
`experimental.defaultContext`, etc. This works for `config.json` users
(`loadContinueConfigFromJson`), but **silently does nothing** for
`config.yaml` users (`loadContinueConfigFromYaml`) — no error, no log,
`modifyConfig()` is simply never called.

Confirmed via `git log -S"modifyConfig" -- core/config/yaml/loadYaml.ts`:
zero hits since the file's creation (`04d73a8ac WIP load config.yaml`).
This is **not a regression** — `config.yaml` users have never had
`config.ts` support; only the legacy JSON pipeline ever wired it up.

A second, independent bug compounds this: even after wiring
`modifyConfig()` into the YAML pipeline, any custom context provider it
adds (a plain object: `{ title, getContextItems, ... }`) needs to be
wrapped in `CustomContextProviderClass` to expose a working
`.description` getter — `intermediateToFinalConfig()` does this for the
JSON pipeline, but the YAML pipeline's `configYamlToContinueConfig()` has
no equivalent step (its config is already "final" by that point). Without
the wrap, `provider.description` is `undefined`, and
`context/getContextItems`'s lookup (`provider.description.title === name`)
can never match — the provider shows up in `config.contextProviders`
(visible if you log `.map(p => p.description?.title)`, which prints
`null`/`undefined` for it) but is never actually invoked.

## What this patch does

- Extracts the config.ts-application logic out of
  `loadContinueConfigFromJson` into a new exported
  `applyConfigTsIfPresent()` in `core/config/load.ts` (same esbuild
  build/require dance, same remote-config.js support — just made
  reusable).
- `applyConfigTsIfPresent()` additionally wraps any context provider added
  by `modifyConfig()` that doesn't already have a `.description` object
  with a `.title`, using `CustomContextProviderClass`.
- Calls it from `loadContinueConfigFromYaml()`, right after the YAML
  pipeline builds its own config (`configYamlToContinueConfig` +
  `modifyAnyConfigWithSharedConfig`).
- `loadContinueConfigFromJson`'s existing inline handling is **left
  untouched** — it's followed immediately by `intermediateToFinalConfig()`,
  which already does its own wrapping pass; routing it through the new
  shared helper too would double-wrap providers there.

## Verified

Tested against a real `config.yaml` + `config.ts` defining two custom
context providers (`taskCtx`, `modeCtx`) wired through
`experimental.defaultContext`, across all 7 signal patterns in a
classifier routing table. Patched directly into an installed Continue
1.2.24 build first (binary patch on the bundled `out/extension.js`) and
confirmed end-to-end via a temporary file-based debug log tracing:
`modifyConfig()` invoked → `experimental.defaultContext` set correctly →
GUI requests `context/getContextItems` for the right provider names →
handler finds the (now-wrapped) provider → provider's `getContextItems`
called → file content found and returned → item lands in the persisted
session's `contextItems`. All 7/7 patterns passed before this fix was
ported to the real TypeScript source here.

## Why this is safe to upstream as-is

- Zero behavior change for `config.json` users — their code path is
  untouched.
- Zero behavior change for `config.yaml` users who don't have a
  customized `config.ts` — `applyConfigTsIfPresent()` is a no-op unless
  `~/.continue/config.ts` exists and differs from the default template
  (same early-return as the existing `buildConfigTsandReadConfigJs`).
- Purely additive: turns a silent no-op into the documented, intended
  behavior.

## Rebasing onto newer upstream commits

```bash
cd continue
git fetch upstream
git checkout fix/config-ts-yaml-pipeline
git rebase upstream/main
git push -f origin fix/config-ts-yaml-pipeline
```
