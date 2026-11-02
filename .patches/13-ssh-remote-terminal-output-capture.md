# Patch 13 — SSH Remote Terminal Output Capture

> **Branch:** `feature/20261026.terminal-remote-ssh`
> **Base commit:** `0bb3ea963` (develop)
> **Patch commits:** `66f2ddb23` (implement), `03e254041` (handoff), current (fix + docs)

---

## Mục tiêu

Mở rộng khả năng capture output của tool `run_terminal_command` từ chỉ hỗ trợ
`remoteName = "wsl"` sang hỗ trợ **tất cả remote environment phổ biến**:

| `remoteName` | Môi trường | Hỗ trợ sau patch |
|---|---|:---:|
| `""` / `"local"` | Local machine | ✅ (local spawn, không đổi) |
| `"wsl"` | WSL2 Ubuntu | ✅ (đã có từ patch 10) |
| `"ssh-remote"` | VS Code Remote-SSH | ✅ **MỚI** |
| `"dev-container"` | Dev Containers | ✅ **MỚI** |
| `"codespaces"` | GitHub Codespaces | ✅ **MỚI** |

---

## Phát hiện then chốt — Không cần viết engine mới

Patch 10 đã xây dựng `runViaFileCapture()` hoàn toàn remote-agnostic:

```
baseUri = vscode.Uri.parse(wsDirs[0])          // giữ nguyên authority
baseUri.with({ path: "/tmp/continue_out_<id>" }) // URI trỏ đúng máy remote
vscode.workspace.fs.readFile(uri)              // API có authority-aware routing
```

Engine này hoạt động với mọi remote — chỉ bị **gate cứng** bởi 1 dòng:

```typescript
// TRƯỚC (patch 10):
if (ideInfo.remoteName === "wsl") {
  // capture output
} else {
  return "Command executed in remote terminal. Output capture is not yet available...";
}
```

→ Fix đơn giản: bỏ gate đó, thêm logic tổng quát.

---

## Các thay đổi

### 1. `core/util/remoteTerminal.ts` — **File mới** (149 dòng)

Helper thuần (không import `vscode`), unit-test được:

```typescript
// Danh sách remote được hỗ trợ capture output
export const OUTPUT_CAPTURE_CAPABLE_REMOTES = ["wsl", "ssh-remote", "dev-container", "codespaces"];

// Circuit breaker: tắt capture sau N lỗi liên tiếp
export const MAX_CAPTURE_FAILURES_BEFORE_DISABLE = 2;
export function shouldAttemptCapture(failures: number, succeeded: boolean): boolean
export function nextCaptureFailureCount(failures: number, succeeded: boolean): number
```

Key design decisions:
- **Per-remote failure budget** — SSH host hỏng không tắt capture của WSL
- `shouldAttemptCapture(failures, false)` = kiểm tra budget; `(failures, true)` = reset
- `remoteOutputUnavailableMessage(remoteName)` phân biệt "unsupported" vs "capture failed"
- `SHELL_INTEGRATION_MISSING_MARKER` — marker đặc biệt để tool phân biệt trường hợp
  shell integration không có

### 2. `core/tools/implementations/runTerminalCommand.ts` (+81/-20)

Thay gate cũ bằng logic tổng quát:

```typescript
// TRƯỚC:
if (ideInfo.remoteName === "wsl") { ... }

// SAU:
const captureCapable = supportsRemoteTerminalOutput(remoteName);
const failures = captureFailureCounts.get(remoteName) ?? 0;
if (captureCapable && shouldAttemptCapture(failures, false)) {
  const result = await ide.runCommandWithOutput(command, timeoutMs);
  // thành công → reset counter; thất bại → ++
  const succeeded = !result.includes(SHELL_INTEGRATION_MISSING_MARKER);
  captureFailureCounts.set(remoteName, nextCaptureFailureCount(failures, succeeded));
}
```

- `const captureFailureCounts = new Map<string, number>()` — module-level, key = `remoteName`
- Base64-wrap lệnh multi-line thành 1 dòng để `sendText` không bị dán vỡ
- Fallback message dùng `remoteOutputUnavailableMessage(remoteName)` — có tên remote cụ thể

### 3. `extensions/vscode/src/VsCodeIde.ts` (+61/-5)

**Thêm temp dir fallback** (cho SSH target harden `/tmp`):

```typescript
// Probe /tmp, fallback về workspace root nếu không ghi được
const tmpWritable = await vscode.workspace.fs.stat(baseUri.with({ path: "/tmp" }))
  .then(() => true, () => false);
const outPath = tmpWritable ? `/tmp/continue_out_${id}` : `${workspaceRoot}/.continue_out_${id}`;
```

**Fix bug `${PIPESTATUS[0]}` trên dash/sh** — visible mode wrapper:

```
TRƯỚC (bash-only — vỡ trên dash/sh):
  ( set -o pipefail 2>/dev/null ; { cmd ; } 2>&1 | tee out ) ; __rc=$? ; printf '%s\n' "$__rc" > done

VẤN ĐỀ:
  - `set -o pipefail` trong dash → "Illegal option", exit code 2
  - Subshell bắt đầu bằng lệnh lỗi → $? = 2 ngay cả khi có `2>/dev/null`
  - tee không bao giờ chạy, done-file không được ghi → stalls until timeout

SAU (POSIX-safe — bash, dash, sh):
  { cmd ; printf '%s\n' "$?" > done ; } 2>&1 | tee out

KEY INSIGHT: Ghi exit code BÊN TRONG group (trái pipe), trước khi tee chạy.
  - tee luôn exit 0 → không thể dùng outer $?
  - printf vào done-file là synchronous trước khi pipe đóng
  - Không cần pipefail, không cần PIPESTATUS
```

**Thêm `SHELL_INTEGRATION_MISSING_MESSAGE`** thay message hardcode cũ:
```typescript
terminal.sendText(SHELL_INTEGRATION_MISSING_MESSAGE);
// Tool phân biệt được "lệnh không chạy được" vs "capture thành công"
```

---

## Tests

### `core/util/remoteTerminal.vitest.ts` — 29/29 PASS

- capable/incapable/undefined/case-insensitive remotes
- tính disjoint của `isLocalIde` vs `supportsRemoteTerminalOutput`
- failure budget: increment, reset, không âm, disable sau `MAX_CAPTURE_FAILURES_BEFORE_DISABLE`
- marker không lọt vào message khác

### `core/tools/implementations/runTerminalCommand.vitest.ts` — 38 PASS / 8 FAIL

8 fail là **pre-existing** (xác nhận bằng `git stash` test baseline):
- 7/8: PowerShell spawn bị block trong vitest trên Windows → timeout 5s
- 1/8: `file://` URI path giả định POSIX path → không chạy được trên Windows

Test remote mới (12 tests) không spawn PowerShell → pass ổn định trên cả Windows lẫn CI Linux.

### Verify POSIX wrapper trên WSL — 18/18 PASS

```bash
# bash, dash, sh × visible, silent × exit 9, exit 0, no output
# → 18/18 PASS
```

---

## Bug fix chi tiết — dash/sh visible mode

### Reproduce (trước fix)

```bash
dash -c "( set -o pipefail 2>/dev/null ; { echo <b64> | base64 -d | bash ; } 2>&1 | tee /tmp/out ) ; __continue_rc=\$? ; printf '%s\n' \"\$__continue_rc\" > /tmp/done"
# stderr: dash: Illegal option -o pipefail
# done-file: rc=2 (exit code của set builtin!)
# out-file: NOT written
```

### Root cause

`set -o pipefail` là **bash extension**, dash không có. Khi dash execute:
1. `set -o pipefail` → exit code 2 (illegal option)
2. Lỗi bị suppress (`2>/dev/null`) nhưng `$?` của **subshell** vẫn = 2
3. Subshell `( ... )` exit 2 → outer `__continue_rc=2`
4. `{ cmd } 2>&1 | tee out` **không bao giờ chạy** vì subshell đã exit

### Fix

```bash
# Viết exit code TRONG group, trái pipe:
{ echo <b64> | base64 -d | bash ; printf '%s\n' "$?" > /tmp/done ; } 2>&1 | tee /tmp/out
```

Verified trên bash 5.2, dash 0.5.12, sh (→ dash symlink trên Ubuntu 24.04).

---

## Giới hạn và hướng tối ưu sau

### SSH extension host chạy trên server

Với `ssh-remote`, extension host chạy **trên chính server SSH**. Nghĩa là
`childProcess.spawn()` trong `VsCodeIde` thực ra chạy trực tiếp trên máy đích —
giống local, không cần đi qua terminal.

Hướng tối ưu: phát hiện "extension host cùng máy với workspace" và dùng
`localSpawn` thay vì file-capture qua terminal. Cần thêm flag vì không thể
đoán đơn thuần từ `remoteName`.

### Windows SSH target

`/tmp` không tồn tại trên Windows. Đã có fallback sang workspace root, nhưng
base64-encode vẫn gọi `/bin/bash` — SSH vào Windows server sẽ fail. Scope
hiện tại: Linux-based SSH targets only.

---

## Files thay đổi

| File | Thay đổi |
|---|---|
| `core/util/remoteTerminal.ts` | **TẠO MỚI** — remote detection, circuit breaker helpers |
| `core/util/remoteTerminal.vitest.ts` | **TẠO MỚI** — 29 tests |
| `core/tools/implementations/runTerminalCommand.ts` | +81/-20 — gate mới, per-remote budget |
| `core/tools/implementations/runTerminalCommand.vitest.ts` | +210 — 12 tests mới cho remote |
| `extensions/vscode/src/VsCodeIde.ts` | +61/-5 — temp-dir fallback, POSIX wrapper fix |
