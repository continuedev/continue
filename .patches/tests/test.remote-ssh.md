# Continue Extension — Tool Call Status trên Remote-SSH Workspace

**Ngày:** 2026-10-27 10:47
**Server:** `apbiocomm1-1up` — Ubuntu, kernel 6.8.0-71-generic, x86_64
**User/cwd:** `devops` / `/data/home/devops`
**remoteName:** `ssh-remote`  |  **TERM_PROGRAM:** `vscode` (shell integration đang bật)
**Login shell:** `/bin/bash`  |  **/bin/sh → dash**  |  git 2.43.0
**Build test:** extension đã rebuild + install (branch `feature/20261026.terminal-remote-ssh`)

---

## KẾT LUẬN: Terminal tool call trên Remote-SSH ĐÃ HOẠT ĐỘNG

Không còn thông báo *"Output capture is not yet available for remote environments"*.
Output + exit code + stderr đều trả về model đầy đủ.

### Bằng chứng engine capture chạy thật trên server
```
$ ps -ef | grep tee
devops 3045995 ... tee /tmp/continue_out_1793072801393_wt643e
```
→ `runViaFileCapture()` (patch 10) đang execute **trên chính server SSH**.
Engine vốn đã remote-agnostic (`baseUri.with({path})` + `vscode.workspace.fs`
authority-aware) → patch 13 chỉ bỏ gate `remoteName === "wsl"` là đủ.

---

## 1. Terminal tool call — test chi tiết

| # | Ca kiểm tra | Lệnh | Kết quả |
|---|-------------|------|---------|
| 1 | Basic, nhiều lệnh `;` | `pwd; uname -a; echo $TERM_PROGRAM` | ✅ output đủ |
| 2 | **Exit code khác 0** | `echo "..."; exit 7` | ✅ `Command exited with code 7` |
| 3 | **Heredoc multi-line** | `cat <<'EOF' ... EOF` | ✅ `line one` / `line two with 'quotes' and $VAR and pipe\|char` |
| 4 | **stdout + stderr lẫn nhau** | `echo a; echo b >&2; ls /nope` | ✅ cả 3 dòng, đúng thứ tự |
| 5 | Lệnh có exit!=0 bên trong pipeline | `ls /definitely/not/exist \| head -2` | ✅ error text bắt được |
| 6 | Temp file cleanup | `ls /tmp/continue_*` | ✅ không còn rác (xem ghi chú dưới) |

**Ghi chú về "temp file rác":** `ls /tmp/continue_*` luôn liệt kê 1 file — đó là
file capture **của chính lệnh `ls` đó** (`cat "$ME"` in ra tên chính nó → self-referential).
Cleanup hoạt động đúng, không có rác tồn đọng.

**Limitation đã biết:** `runCommandWithOutput` dùng
`vscode.window.activeTerminal ?? vscode.window.terminals[0]` → lệnh được gửi vào
terminal **đang active**, không phải terminal riêng. Nếu bạn focus sang terminal khác
giữa chừng, lệnh sẽ chạy ở đó. (Không phải bug mới — cùng design với WSL patch.)

---

## 2. Các tool call khác — đều hoạt động trên REMOTE

| Tool | Kết quả | Ghi chú |
|------|---------|---------|
| `ls` | ✅ | liệt kê đúng `/data/home/devops` trên server |
| `file_glob_search` | ✅ | `scripts/*` → 19 file, đúng thứ tự |
| `read_file` | ✅ | đọc `scripts/check-connectivity.sh`, giữ nguyên UTF-8 + box-drawing (`─`, `✓`) |
| `create_new_file` | ✅ | tạo `.continue-probe/probe.txt` |
| read-back sau write | ✅ | nội dung khớp |
| **Xác minh file nằm trên server** | ✅ | `ls`/`cat` qua terminal thấy file trên `apbiocomm1-1up` → **authority routing đúng, không ghi nhầm về Windows** |
| `run_terminal_command` (delete) | ✅ | dọn probe thành công |

`grep_search` chưa test độc lập (không có repo lớn trong workspace này để test ý nghĩa);
nó đi qua cùng cơ chế `vscode.workspace.fs`/ripgrep như `file_glob_search` nên kỳ vọng OK —
**nếu cần chắc chắn, test trên 1 git repo thật trên server.**

---

## 3. Phát hiện kiến trúc quan trọng

```
$ ls ~/.vscode-server/extensions/   → chỉ có extensions.json  (KHÔNG có Continue)
$ ls ~/.continue/                   → không tồn tại trên server
$ ls -d ~/.continue*                → (none)
```

→ **Continue là UI-extension, chạy trên Windows (local), KHÔNG cài trên server.**
Server chỉ chạy `vscode-server` (node processes đã xác nhận qua `ps`).

Hệ quả:
- `childProcess.spawn()` trên extension host = chạy trên **Windows** → **vẫn đúng**
  khi chặn mọi remote khỏi local-spawn. Kết luận trong handoff ("SSH có thể đi
  đường local-spawn nhanh hơn") là **SAI** → **đừng refactor theo hướng đó**.
- Config/index/session của Continue nằm ở Windows; chỉ file I/O + terminal là remote-aware.

---

## 4. ⚠️ BUG TỒN TẠI (chưa sửa) — `visible` mode hỏng trên dash

`continue.remoteTerminalOutputMode = "visible"` **không dùng được** nếu shell
tương tác của user không phải bash.

```
dash: 1: Bad substitution          ← code GỐC (PIPESTATUS)
dash: 1: set: Illegal option -o pipefail   ← code FIX hiện tại của tôi
```

**Root cause:** `dash` **không hỗ trợ `set -o pipefail`** (xác nhận trên server này).
Cả bản gốc và bản fix đều fail → done-file không ghi được → treo tới timeout.

| Shell | `silent` (default) | `visible` — bản gốc | `visible` — fix hiện tại |
|-------|:------------------:|:-------------------:|:------------------------:|
| bash  | ✅ | ✅ | ✅ |
| dash / `sh` | ✅ | ❌ Bad substitution | ❌ Illegal option |

**Tác động thực tế với bạn: KHÔNG ĐANG BỊ ẢNH HƯỞNG** — default là `silent`
và `silent` dùng `{ cmd ; } > out 2>&1 ; printf '%s\n' "$?" > done` → POSIX thuần,
chạy OK trên cả dash. Bạn đang dùng `silent` nên mọi test ở mục 1 đều pass.

**Fix đúng (POSIX, không cần pipefail) — áp dụng cho cả bash + dash:**
```
{ { { cmd ; } > "$out" 2>&1 ; printf '%s\n' "$?" > "$done" ; } ; } | tee -a "$out"
```
- `printf '%s\n' "$?"` bên trong `{}` → ghi **exit code của lệnh**, không phải của tee
- `> "$out"` **truncate**, `tee -a` **append** → file cuối = output + dòng exit code
  → cần bỏ dòng cuối khi parse output
- `2>/dev/null` ở fix hiện tại đang **che mất lỗi** → nên bỏ để dễ debug

**Việc code còn nợ (repo ở Windows, không truy cập được từ terminal SSH này):**
1. Sửa `visible` wrapper theo công thức POSIX ở trên
2. Bỏ `2>/dev/null` để lỗi shell hiện ra thay vì treo
3. Cân nhắc auto-fallback `visible` → `silent` khi capture timeout
4. Test `grep_search` trên 1 git repo thật trên server
5. Viết `.patches/13-ssh-remote-terminal-output-capture.md`
   (ghi rõ: engine patch 10 đã generic; Continue là UI-extension nên không dùng
   spawn trên SSH; bug dash/pipefail)
6. Update `.patches/10-...md` mục "Scope giới hạn" (đang ghi SSH "chưa test" → lỗi thời)

---

## 5. Files đã verify trong phiên này

| File | Trạng thái |
|------|-----------|
| `scripts/check-connectivity.sh` | read ✅ (UTF-8 + Unicode OK) |
| `scripts/` (19 file) | glob ✅ |
| `.continue-probe/probe.txt` | create → read → delete ✅ (đã dọn sạch) |
| Repo `/mnt/e/03-Sources/9.goku/continue` | ❌ **không truy cập được từ terminal này** (terminal trỏ server SSH, không phải Windows) → mọi sửa code phải làm ở workspace Windows hoặc qua đường khác |