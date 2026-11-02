# Session Handoff — Remote-SSH Terminal Output Capture

- **Ngày/giờ:** 2026-10-26 17:12
- **Repo:** `/mnt/e/03-Sources/9.goku/continue` (WSL path) — Continue fork
- **Branch:** `feature/20261026.terminal-remote-ssh`
- **HEAD:** `66f2ddb23 prepare`
- **Loại session:** Feature implementation (agent mode)
- **Mục tiêu:** Mở rộng khả năng capture output của tool `run_terminal_command`
  từ chỗ chỉ hỗ trợ `remoteName = "wsl"` sang hỗ trợ **Remote-SSH**
  (`remoteName = "ssh-remote"`), dựa trên nền patch 10.

---

## 1. Bối cảnh & phát hiện then chốt

### Vấn đề của user
Dùng VS Code Remote-SSH tới server Linux. Continue báo:
> "Command executed in remote terminal. Output capture is not yet available for remote environments."

### Phát hiện quan trọng nhất (tiết kiệm phần lớn công sức)

Patch 10 (`d04013d78`) **đã xây dựng engine capture hoàn chỉnh và total-generic**.
Nó chỉ bị **gate cứng** bởi 1 dòng:

```
core/tools/implementations/runTerminalCommand.ts:563
  if (ideInfo.remoteName === "wsl") {   // <-- chỉ wsl
```

Engine `runViaFileCapture()` vốn đã remote-agnostic:
- `baseUri = vscode.Uri.parse(wsDirs[0])` → giữ nguyên `authority`
  (`wsl+UBUNTU` **hoặc** `ssh-remote+myhost`)
- `baseUri.with({ path: "/tmp/continue_out_<id>" })` → URI trỏ đúng máy remote
- Poll + đọc file bằng `vscode.workspace.fs` → **API có authority-aware routing**
- Strategy: `{ <cmd> } > <out> 2>&1 ; echo $? > <done>` → deterministic, không race PTY

=> **Không cần viết engine mới.** Chỉ cần bỏ gate + vá các gap thật sự.

### Kiến trúc hiện tại của `runCommandWithOutput` (VsCodeIde.ts)

```
runCommandWithOutput(command, timeoutMs)
  ├─ PRIMARY : runViaFileCapture()   <- deterministic, file-based, KHÔNG dùng shell integration
  │            base64-encode command -> sendText 1 dòng -> poll done-file qua workspace.fs
  └─ FALLBACK: shellIntegration.executeCommand() + read() stream
               (chỉ khi resolve được baseUri nhưng file capture trả null)
```

`runViaFileCapture` **không cần shell integration** → SSH server chỉ cần
`bash` + `base64` + `/tmp` ghi được.

---

## 2. Đã hoàn thành

### 2.1 File MỚI — `core/util/remoteTerminal.ts` (149 dòng)

Helper thuần (không import `vscode`) → unit-test được, dùng chung cho `core` + `extensions/vscode`.

| Export | Ý nghĩa |
|---|---|
| `OUTPUT_CAPTURE_CAPABLE_REMOTES` | `["wsl","ssh-remote","dev-container","codespaces"]` |
| `LOCAL_REMOTE_NAMES` | `["", "local"]` |
| `supportsRemoteTerminalOutput(rn)` | remote nào được capture |
| `isLocalIde(rn)` | rn nào spawn trực tiếp được (undefined = local) |
| `MAX_CAPTURE_FAILURES_BEFORE_DISABLE` | `2` |
| `shouldAttemptCapture(failures, succeeded)` | circuit breaker |
| `nextCaptureFailureCount(failures, succeeded)` | reset 0 khi thành công, ++ khi lỗi, không âm |
| `remoteCommandStatus(exitCode)` | `"Command completed"` / `"Command exited with code N"` |
| `remoteOutputUnavailableMessage(rn)` | message fallback, phân biệt "unsupported" vs "capture failed" |
| `SHELL_INTEGRATION_MISSING_MARKER` | `"[continue:shell-integration-unavailable]"` |
| `SHELL_INTEGRATION_MISSING_MESSAGE` | có nhúng marker ở trên |

### 2.2 File MỚI — `core/util/remoteTerminal.vitest.ts` (244 dòng, **29 tests**)
Cover: capable/uncapable/undefined/case-sensitivity, tính **disjoint** của
`isLocalIde` vs `supportsRemoteTerminalOutput`, failure budget, reset budget,
marker không lọt vào message khác. → **29/29 pass** (đã chạy, xem §4).

### 2.3 Sửa `core/tools/implementations/runTerminalCommand.ts` (+81/-20)

- Thêm import từ `../../util/remoteTerminal`
- Thêm module state: `const captureFailureCounts = new Map<string, number>()`
  (**key theo remoteName** → SSH host hỏng không làm tắt capture của WSL)
- **Thay nhánh `remoteName === "wsl"`** bằng nhánh tổng quát:
  ```
  const captureCapable = supportsRemoteTerminalOutput(remoteName);
  const failures = captureFailureCounts.get(remoteName) ?? 0;
  if (captureCapable && shouldAttemptCapture(failures, false)) { ... }
  ```
- Thành công (`output` không chứa marker) → reset counter; ngược lại → ++
- `status` dùng `remoteCommandStatus(exitCode)` (đã tồn tại từ patch 10 — không đổi hành vi)
- **Fire-and-forget giờ base64-wrap lệnh multi-line** (`/bin/bash` một dòng) —
  tránh heredoc bị `sendText` dán hỏng. Đây là hành vi mới, có test.
- Fallback message dùng `remoteOutputUnavailableMessage(remoteName)`

### 2.4 Sửa `extensions/vscode/src/VsCodeIde.ts` (+39, và +17/-5 chưa commit)

**(a) Temp dir fallback** — thay vì hardcode `/tmp`:
```
stat(baseUri.with({path:"/tmp"})) thành công -> /tmp/continue_{out,done}_<id>
thất bại                                     -> <workspaceRoot>/.continue_{out,done}_<id>
```
Lý do: SSH target harden mount `/tmp` noexec/restrict.

**(b) `SHELL_INTEGRATION_MISSING_MESSAGE`** thay message hardcode cũ → tool
phân biệt được "lệnh chạy nhưng không đọc được output" vs capture thành công.

**(c) FIX BUG thật — `visible` mode hỏng trên `sh`/`dash`** (CHƯA commit):
```diff
- { echo $b64 | base64 -d | bash ; } 2>&1 | tee $out ; echo ${PIPESTATUS[0]} > $done
+ ( set -o pipefail 2>/dev/null ; { echo $b64 | base64 -d | bash ; } 2>&1 | tee $out ) ; __continue_rc=$? ; printf '%s\n' "$__continue_rc" > $done
```
`${PIPESTATUS[0]}` là **bash-only**. Dòng wrapper được `sendText` vào
**interactive shell của user** → trên Debian/Ubuntu `/bin/sh = dash` báo
`Bad substitution` → done-file không ghi → **treo tới timeout**.
Đã reproduce: `sh: 1: Bad substitution`, rc=2.
Đồng thời silent mode đổi `echo $?` → `printf '%s\n' "$?"` (POSIX-safe).

### 2.5 Sửa `core/tools/implementations/runTerminalCommand.vitest.ts` (+210)

- Thêm `mockRunCommandWithOutput` vào mock IDE
- Test cũ `"should use ide.runCommand for WSL environment"` (encode hành vi
  cũ, **đã fail ở baseline**) → viết lại thành `"should capture output via
  runCommandWithOutput for WSL"` → **PASS**
- Thêm 12 test mới trong `describe("remote environment handling")`:
  ssh-remote capture, `it.each` dev-container+codespaces, non-zero exit code,
  `(no output)`, unsupported remote được nêu tên, base64-wrap multi-line,
  circuit breaker, reset budget, **isolate budget per-remote**

---

## 3. Trạng thái verify

| Hạng mục | Kết quả |
|---|---|
| `core` tsc `--noEmit` | ✅ exit 0, 0 dòng lỗi |
| `extensions/vscode` tsc `--noEmit` | ✅ exit 0, 0 dòng lỗi (cả trước & sau sửa) |
| `core/util/remoteTerminal.vitest.ts` | ✅ 29/29 pass |
| `runTerminalCommand.vitest.ts` | 38 pass / 8 fail — **toàn bộ fail là pre-existing + môi trường** (xem §5) |
| Audit `VsCodeIde.ts` (user nghi typing nhầm) | ✅ **SẠCH** — 1097 dòng, brace 234/234, paren 517/517, bracket 65/65, backtick 62 (chẵn), 0 ký tự lạ ngoài comment/string, tsc exit 0 |
| Wrapper POSIX (silent mode) | ✅ test thủ công: rc=7 đúng, stdout+stderr lẫn lộn đúng |
| Wrapper POSIX (visible mode) | ⚠️ **CHƯA verify lại sau khi fix** — đây là việc #1 sáng mai |

---

## 4. Việc cần làm tiếp (theo thứ tự ưu tiên)

1. **Verify fix `visible` mode** bằng cách chạy wrapper giả lập trên `bash`, `dash`, `sh`:
   ```bash
   for SH in bash dash sh; do
     B64=$(printf 'echo out1; echo err1 >&2; exit 9' | base64 -w0)
     O=/tmp/o_$SH; D=/tmp/d_$SH; rm -f $O $D
     $SH -c "{ echo $B64 | base64 -d | bash ; } 2>&1 | tee $O ; __continue_rc=\$? ; printf '%s\n' \"\$__continue_rc\" > $D"
     echo "$SH -> rc=$(cat $D) out=$(tr '\n' '|' < $O)"
   done
   ```
   Kỳ vọng: cả 3 → `rc=9`. (trước fix: dash/sh ra `Bad substitution`)
   Lệnh này bị cancel cuối phiên → **chưa có kết quả**.

2. **End-to-end test thật trên Remote-SSH** (bắt buộc, chưa làm gì):
   - Build VSIX theo `deploy/01-build-extension/build-windows.ps1` (xem patch 12)
   - Install vào VS Code, mở workspace Remote-SSH
   - Gọi tool: `pwd`, `uname -a`, `echo test`, `ls -la`, lệnh multi-line heredoc,
     lệnh exit!=0, lệnh chạy >2 phút
   - Check marker trong bundle: `grep -c "continue:shell-integration-unavailable" <gui/extension bundle>`

3. **Viết `.patches/13-ssh-remote-terminal-output-capture.md`** — chưa tạo.
   (Đã reference tên file này trong comment ở `runTerminalCommand.ts:~110`
   → nếu đổi tên patch thì sửa comment.)
   Nội dung cần có: gate cũ, danh sách 4 remote, circuit breaker, temp-dir
   fallback, bug `${PIPESTATUS[0]}` trên dash, khác biệt WSL vs SSH
   (extension host chạy **trên** server SSH → `childProcess.spawn` *có thể*
   hoạt động — xem ghi chú §6).

4. **Cập nhật `.patches/README.md`** (index row 13) + `.patches/10-...md`
   (section "Scope giới hạn" hiện ghi SSH "chưa được test" → đã lỗi thời).

5. **Commit** phần `VsCodeIde.ts` đang uncommitted.

6. Cân nhắc: test `it.each` + `MAX_CAPTURE_FAILURES_BEFORE_DISABLE` có state
   module-level `captureFailureCounts` dùng chung giữa các test trong cùng file
   → hiện pass, nhưng nếu thêm test mới hãy nhớ reset hoặc dùng remoteName riêng.

---

## 5. 8 test fail — KHÔNG phải do ta gây ra (đã chứng minh)

Baseline (`git stash` code của ta, chạy trên commit `0bb3ea963`): **6 fail / 30 pass**.
Sau khi sửa: **8 fail / 38 pass** (46 tests).

**Nguyên nhân gốc (đã isolate bằng 7 probe file):**
Mọi `childProcess.spawn("powershell.exe", ...)` đều **treo vô hạn** khi chạy
**trong vitest** trên host này — kể cả `spawn("powershell.exe", ["-Command","echo SIMPLE"])`
tối giản, 0 bytes stdout. Trong khi đó:
- `spawn("cmd.exe", ["/c","echo HELLO"])` → ✅ OK
- `childProcess.exec("node -e ...")` → ✅ OK
- `spawn(process.execPath, ["-e", ...])` → ✅ OK
- **Cùng lệnh powershell chạy ngoài vitest → ✅ OK**

=> Kết luận: constrained-language mode / AV blocking PowerShell **non-interactive**
trong sandbox của vitest. `getShellCommand()` trên win32 dùng `powershell.exe`
nên mọi test local spawn đều timeout 5s. **Không sửa** — nằm ngoài scope, và
là lý do thật sự khiến các test đó đỏ (không phải logic remote).

7/8 fail = `Test timed out in 5000ms`, 1/8 = `File URL path must be absolute`
(test `file://` URI giả định path POSIX → không chạy được trên Windows).

**Hệ quả may:** toàn bộ test remote của ta **không spawn gì** (mock IDE) →
deterministic, pass ổn định, chạy được cả trên Windows lẫn CI Linux.

---

## 6. Ghi chú kỹ thuật quan trọng — cân nhắc cho bước sau

- **SSH khác WSL về bản chất**: với Remote-SSH, extension host chạy **trên chính
  server SSH** (`extensionKind: ["ui","workspace"]` → workspace host ở remote).
  Nghĩa là `childProcess.spawn()` **có thể** chạy đúng máy trên SSH, tức về lý
  thuyết SSH có thể đi đường local-spawn nhanh hơn (streaming output thật, exit
  code chính xác, hỗ trợ `waitForCompletion:false`).
  → **Đây là hướng tối ưu chưa explore.** Hiện ta cố tình đi qua terminal cho
  đồng nhất và an toàn. Nếu làm, cần thêm flag phân biệt "extension host ở cùng
  máy với workspace" thay vì đoán qua `remoteName`.
- `runCommand()` trong `VsCodeIde` gọi `terminal.sendText(command, false)` —
  `false` = **không gửi Enter**. Đây là hành vi upstream; nếu SSH fire-and-forget
  có vẻ "không chạy" thì kiểm tra chỗ này trước.
- `VsCodeMessenger.ts:332` đã forward `runCommandWithOutput` đầy đủ — **không cần sửa**.
- `core/util/filesystem.ts` (FileSystemIde) đã có stub — **không cần sửa**.
- `core/index.d.ts` + `core/protocol/ide.ts` + `messageIde.ts` — **không cần sửa**
  (đã có từ patch 10).
- `extensions/vscode/tsconfig.json` include `../../core/**/*.ts` → esbuild bundle
  `core` trực tiếp từ source, **không cần `core/dist`** cho VSIX (patch 12).

---

## 7. Files cần đọc trong phiên mới

| File | Lý do |
|---|---|
| `.patches/10-wsl-remote-terminal-output-capture.md` | Patch nền — nền tảng lý thuyết |
| `core/util/remoteTerminal.ts` | Toàn bộ decision logic mới |
| `core/tools/implementations/runTerminalCommand.ts` (dòng ~100-135 và ~575-655) | Gate mới + circuit breaker |
| `extensions/vscode/src/VsCodeIde.ts` (dòng ~397-500) | `runViaFileCapture` — engine capture |
| `deploy/01-build-extension/README.md` + patch 12 | Cách build VSIX trên Windows |

## 8. Constraints cần nhớ

- Build phải chạy **Windows/PowerShell native**, không build từ WSL (patch 12).
- `deploy/01-build-extension/sync-nexus-npmrc.ps1` phải chạy trước khi build.
- `build-windows.ps1` cần `-NoInstall` khi chạy qua tool (không có stdin tương tác).
- File tạm agent → `./.continue/tmp/` (không dùng `/tmp`).
- `single_find_and_replace` trong workspace này resolve path theo **Continue
  workspace root**, KHÔNG phải repo root → **đã 1 lần làm mất import** (formatter
  chạy lại và drop import mới thêm). **Luôn `grep` xác nhận import còn sau khi sửa.**
- `edit_existing_file` bị cấm (từng làm cụt file).
