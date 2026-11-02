# Custom Patches — Continue Extension (On-Prem / Self-Managed)

> **Cập nhật lần cuối:** 2026-10-27
> **Base upstream:** `continuedev/continue` @ `upstream/main` (5522c6f)
> **Custom version:** `2.2.2` (trên branch `feature/20261026.terminal-remote-ssh`)
> **Fork:** [`thanhnnict/continue`](https://github.com/thanhnnict/continue)

---

## Overview

Fork cá nhân của [`continuedev/continue`](https://github.com/continuedev/continue),
được customize cho môi trường **on-premises** với các LLM server nội bộ (NIM, vLLM)
phục vụ ~300+ developer users qua dịch vụ Vibe coding.

**Models đang phục vụ:** Nemotron Ultra 253B, DeepSeek V4 Flash, Kimi K2.6, GLM-5.2-FP8

---

## Branch Structure

| PR | Branch | File | CLA | CI | Status |
|----|--------|------|-----|----|--------|
| [#13091](https://github.com/continuedev/continue/pull/13091) | `fix/empty-response-retry` | `OpenAI.ts` | ✅ | ⚠️ flaky | OPEN |
| [#13092](https://github.com/continuedev/continue/pull/13092) | `fix/sanitize-tool-arguments` | `openaiTypeConverters.ts` | ✅ | ⚠️ flaky | OPEN |
| [#13093](https://github.com/continuedev/continue/pull/13093) | `feat/always-on-context-usage` | GUI components | ✅ | ✅ | OPEN |
| [#13131](https://github.com/continuedev/continue/pull/13131) | `fix/pending-toolcall-button-overflow` | GUI components (6 files) | ✅ | ✅ | OPEN |

---

## Patch Index

| # | Patch | File(s) | Status | PR |
|---|-------|---------|--------|-----|
| 01 | **NIM/vLLM Empty Response Retry** | `packages/openai-adapters/src/apis/OpenAI.ts` | Active | #13091 |
| 02 | **Tool Arguments JSON Sanitize** | `core/llm/openaiTypeConverters.ts` | Active | #13092 |
| 03 | **Vision Proxy** | `core/llm/visionProxy.ts` (new), `core/llm/index.ts`, `core/index.d.ts`, `packages/config-yaml/src/schemas/models.ts` | Active | #13093 |
| 04 | **TLS Self-Signed Certificate Fix** | `packages/fetch/src/getAgentOptions.ts`, `extensions/vscode/src/extension.ts` | Active | — |
| 05 | **Performance Monitoring** | Research/Proposal | Planned | — |
| 06 | **Capacity Planning (300 Users)** | Research/Proposal | Planned | — |
| 07 | **Upstream Contribution Guide** | Documentation | Reference | — |
| 08 | **TLS Self-Signed Fix** (detailed) | Documentation | Reference | — |
| 09 | **Pending ToolCall Button Overflow Fix** | 6 GUI files | Active | #13131 |
| 10 | **WSL Remote Terminal Output Capture** | `extensions/vscode/src/**` (terminal shell integration) | Active | — |
| 11 | **config.yaml Global Settings & Session Title** | `packages/config-yaml/src/schemas/index.ts`, `packages/config-yaml/src/load/unroll.ts`, `core/index.d.ts`, `core/config/yaml/loadYaml.ts`, `gui/src/redux/thunks/session.ts` | Active | — |
| 12 | **Windows Build Pipeline Fix** | `deploy/**/*.ps1`, `deploy/01-build-extension/sync-npmrc.ps1` (new) | Active | — |
| 13 | **SSH Remote Terminal Output Capture** | `core/util/remoteTerminal.ts` (new), `core/tools/implementations/runTerminalCommand.ts`, `extensions/vscode/src/VsCodeIde.ts` | Active | — |

### Quick Patch Summary

- **Patch 01 — Empty Response Retry:** When NIM/vLLM returns `content: null` with empty `tool_calls: []`, retry without tools so the model returns text instead of blank.
- **Patch 02 — JSON Sanitize:** Validates JSON in `tool_calls.function.arguments` before sending to server. Wraps malformed JSON in `{"_raw": "..."}` to prevent vLLM 400 errors.
- **Patch 03 — Vision Proxy:** Routes image messages through a VLM (Qwen2.5-VL-32B) for text description, enabling text-only LLMs (DeepSeek V4 Flash) to understand images. Configurable per-model via `visionProxy` in `config.yaml`.
- **Patch 04/08 — TLS Self-Signed:** Defaults `rejectUnauthorized` to `false` and sets `NODE_TLS_REJECT_UNAUTHORIZED=0` to allow self-signed certificates in on-prem environments.
- **Patch 09 — Button Overflow:** Fixes Accept/Reject buttons being clipped in narrow sidebar by switching to CSS Grid and using container-relative widths.
- **Patch 10 — WSL Terminal Output Capture:** Captures `run_terminal_command` output reliably in Remote-WSL via VS Code shell-integration sequences, fixing false `(no output)` results for fast git commands.
- **Patch 11 — config.yaml Global Settings & Session Title:** Zod silently stripped `disableSessionTitles`, `systemMessage`, `allowAnonymousTelemetry`, `disableIndexing` from `config.yaml` because they were absent from `baseConfigYamlSchema`. Declares them, carries them through `unrollBlocks()` → `ContinueConfig` → browser config, and makes the fallback session title use the **first** line of the opening message so `NN-<task>` naming conventions work.
- **Patch 12 — Windows Build Pipeline Fix:** Five independent failures that blocked `build-windows.ps1`: PS 5.1 mis-parsing UTF-8 `.ps1` without BOM, npm routing `localhost:7081` through the corporate proxy (403), Nexus not implementing the npm audit API, `$ErrorActionPreference = "Stop"` turning benign stderr warnings into fatal errors, and a blocking `Read-Host` prompt. Adds `sync-npmrc.ps1` and `-NoInstall`.
- **Patch 13 — SSH Remote Terminal Output Capture:** Extends `run_terminal_command` output capture from WSL-only to all common remote environments (`ssh-remote`, `dev-container`, `codespaces`). The engine from patch 10 was already remote-agnostic — only a hard gate needed removing. Adds per-remote circuit breaker, `/tmp` fallback for hardened SSH targets, and a POSIX-safe `visible` mode wrapper that works on bash, dash, and sh (fixes `${PIPESTATUS[0]}` bash-only bug and `set -o pipefail` dash incompatibility).

---

## Versioning

Scheme: `{upstream_major}.{upstream_minor}.{custom_patch}`

| Version | Date | Meaning |
|---------|------|---------|
| `2.1.0` | — | Rebased on upstream v2.1.0 (no custom patches yet) |
| `2.1.1` | 2026-08 | Custom build #1 after rebase (patches 01-04) |
| `2.2.0` | 2026-10-10 | After syncing upstream v2.2.0 |
| `2.2.1` | 2026-10-12 | patches 10, 11, 12 |
| `2.2.2` | 2026-10-27 | **Current** — patch 13 (SSH remote terminal capture) |

---

## Build

Target `win32-x64` build trên Windows (extension host chạy native Windows — Continue
không phải Remote extension). Chi tiết: [`deploy/01-build-extension/README.md`](../deploy/01-build-extension/README.md).


```powershell
# Lan dau hoac sau khi doi dependencies
.\deploy\01-build-extension\sync-npmrc.ps1
.\deploy\01-build-extension\00-pre-install.ps1 -Target win32-x64

# Build
.\deploy\01-build-extension\build-windows.ps1                  # full
.\deploy\01-build-extension\build-windows.ps1 -SkipPackages    # bo build packages
.\deploy\01-build-extension\build-windows.ps1 -OnlyExt         # chi prepackage + vsce
.\deploy\01-build-extension\build-windows.ps1 -NoInstall       # CI / background / redirect log

# Cai vao VS Code installed
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" `
    --install-extension "extensions\vscode\build\continue-win32-x64-2.2.2.vsix" --force
```

| Mode | Thời gian (Goku-P1G3, repo trên `/mnt/e`) |
|------|:--:|
| Full | ~8m |
| `-SkipPackages` | ~5m |
| `-OnlyExt -SkipPackages` | ~2m45s |

> Chậm hơn bảng tham chiếu trong `deploy/README.md` (~60-90s) vì repo nằm trên
> `/mnt/e` (9P filesystem) và `conda run` thêm độ trễ khởi tạo cho mỗi lời gọi npm.
> Bảng kia đo trên macOS arm64 với filesystem local.

Output: `extensions/vscode/build/continue-win32-x64-2.2.2.vsix` (398 files, 106 MB)

### Build artifacts chứa trong VSIX

`prepackage.js` kiểm tra qua `validateFilesPresent`:

- `out/extension.js` — esbuild bundle, **gom luôn `core/` từ source TypeScript**
  (`extensions/vscode/tsconfig.json` include `../../core/**/*.ts`), nên VSIX không cần
  `core/dist`; tuy vậy `build-windows.ps1` vẫn build `core` vì GUI import type từ đó
- `gui/assets/index.js` + `index.css` — vite build, copy từ `gui/dist`
- `bin/napi-v3/win32/x64/onnxruntime*`, `out/build/Release/node_sqlite3.node`
- `out/node_modules/@vscode/ripgrep/bin/rg.exe`, `@lancedb/vectordb-win32-x64-msvc`
- `models/all-MiniLM-L6-v2/**` (embeddings), `tree-sitter/**`

### Verify patch sau build

```bash
EXT=~/.vscode/extensions/continue.continue-2.2.2

# Patch 11 - config.yaml global settings + session title
grep -c "config-yaml-systemMessage"         $EXT/out/extension.js     # 1
grep -c "Scalar global settings are not"    $EXT/out/extension.js     # 1
grep -c "disableSessionTitles: booleanType" $EXT/out/extension.js     # 1
grep -c "slice(0,1)\[0\]"                   $EXT/gui/assets/index.js  # 1

# Patch 01-04
grep -c "retry\|without.*tools" packages/openai-adapters/src/apis/OpenAI.ts   # >= 1
grep -c "sanitize\|JSON.parse"  core/llm/openaiTypeConverters.ts              # >= 1
test -f core/llm/visionProxy.ts && echo "patch 03 OK"
grep -c "rejectUnauthorized"    packages/fetch/src/getAgentOptions.ts         # >= 1
```

> `grep -r` trên `/mnt/e` (9P) không ổn định — dễ treo tới timeout hoặc trả kết quả
> rỗng sai. Luôn giới hạn path cụ thể, tránh quét đệ quy toàn repo.

---

## Known Issues

### `.continue/tmp/` đang bị track trong git

Commit `e2b3dff4b` có include 7 file tạm:

```
.continue/tmp/config-temp.yaml          <- ban copy config.yaml, chua 5 apiKey
.continue/tmp/ps1-bak/*.ps1             (6 file backup)
```

`.continue/tmp/config-temp.yaml` là bản copy của `~/.continue/config.yaml` và **chứa
5 giá trị `apiKey`**. File tạm nên nằm trong `./.continue/tmp/` để user review, nhưng
**không nên commit**. Cách xử lý:

```bash
# 1. Ngăn track tiếp
printf '\n# Agent scratch files - never commit\n.continue/tmp/\n' >> .gitignore

# 2. Bo khoi index (giu file trên dia)
git rm -r --cached .continue/tmp/

# 3. Xoá file rác
rm -rf .continue/tmp/
```

Vì repo đã push, các `apiKey` trong `config-temp.yaml` đã nằm trong git history. Nếu repo
có remote chia sẻ (GitHub fork), cân nhắc **rotate các API key đó**; nếu history chưa lan
rộng có thể scrub bằng `git filter-repo`.

### `deploy/README.md` chưa khớp thực tế

Bảng build time và kích thước VSIX (~70-80 MB) đo trên macOS arm64 / filesystem local.
Đo thực tế trên Windows + `/mnt/e`: ~8m full build, VSIX 106 MB. Đã ghi chú ở Patch 12;
cần chuẩn hoá lại bảng nếu muốn một con số duy nhất.

---

## Xem thêm

- [`deploy/README.md`](../deploy/README.md) — deploy workflow tổng quát
- [`deploy/01-build-extension/README.md`](../deploy/01-build-extension/README.md) — build theo platform
- [`deploy/01-build-extension/troubleshooting.md`](../deploy/01-build-extension/troubleshooting.md) — lỗi build thường gặp
