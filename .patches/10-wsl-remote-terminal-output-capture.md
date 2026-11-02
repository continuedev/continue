
> **Trạng thái:** Active — áp dụng trong branch `develop` / `release/v2.1.x-onprem`
> **Continue version:** `2.1.3`
> **File thay đổi chính:**
> - `core/index.d.ts`
> - `core/protocol/ide.ts`
> - `core/tools/implementations/runTerminalCommand.ts`
> - `core/protocol/messenger/messageIde.ts`
> - `core/util/filesystem.ts`
> - `extensions/vscode/src/VsCodeIde.ts`
> - `extensions/vscode/src/extension/VsCodeMessenger.ts`

---

## Vấn đề

### Môi trường gặp lỗi

- **IDE:** VS Code (Windows 11) hoặc Kiro IDE
- **Workspace mode:** Remote WSL (`vscode.env.remoteName = "wsl"`)
- **Terminal:** Ubuntu-24.04 (WSL2)

### Triệu chứng

Khi Continue Agent gọi tool `run_terminal_command`, lệnh **chạy được trong WSL terminal**
(hiển thị output bình thường trên màn hình) nhưng Continue không nhận được output — chỉ
trả về thông báo:

```
Command executed in remote terminal. Output capture is not yet available for remote environments.
```

Model thấy terminal tool trả về empty output → không thể ra quyết định tiếp theo → loop hỏi
lại người dùng hoặc đưa ra kết quả sai.

---

## Root Cause Analysis

### 1. Architecture mismatch khi dùng Remote WSL

```
┌─────────────────────────────────────────────────────────┐
│  VS Code / Kiro (Windows host)                          │
│                                                         │
│  Continue Extension (extension host — Windows)          │
│      │                                                  │
│      │ terminal.sendText(command)                       │
│      ▼                                                  │
│  VS Code Terminal Bridge ──────────────────────────────►│
│                                    │                    │
│                    ┌───────────────┘                    │
│                    ▼                                    │
│              WSL Ubuntu-24.04 (bash)                    │
│              → lệnh chạy ✅                              │
│              → output hiển thị ✅                        │
│              → output KHÔNG được capture ❌              │
└─────────────────────────────────────────────────────────┘
```

Continue extension host chạy trên **Windows**, nhưng terminal chạy trong **WSL Linux**.
VS Code Shell Integration API (dùng để capture output) hoạt động trong cùng môi trường
với extension host — khi có Remote bridge ở giữa, API không forward output về được.

### 2. Logic phân nhánh trong `runTerminalCommand.ts`

```typescript
const LOCAL_ONLY = ["", "local"];

if (LOCAL_ONLY.includes(ideInfo.remoteName)) {
  // Chạy qua childProcess.spawn() → capture stdout/stderr trực tiếp ✅
  // ...
}

// remoteName = "wsl" → không thuộc LOCAL_ONLY
// → fire-and-forget qua terminal.sendText()
// → trả về hardcoded message ❌
await extras.ide.runCommand(command);
return [{
  content: "Command executed in remote terminal. Output capture is not yet available...",
}];
```

Khi `remoteName = "wsl"`, code rơi vào nhánh fallback — gửi lệnh vào terminal nhưng
không có cơ chế nào để đọc output trở lại.

### 3. `getTerminalContents()` không hoạt động trong Remote

Cơ chế đọc terminal cũ của Continue dùng **clipboard hack**:

```typescript
// Chọn nội dung terminal → copy vào clipboard → đọc clipboard
await vscode.commands.executeCommand("workbench.action.terminal.selectToPreviousCommand");
await vscode.commands.executeCommand("workbench.action.terminal.copySelection");
const content = await vscode.env.clipboard.readText();
```

Với Remote WSL, `workbench.action.terminal.copySelection` chỉ copy nội dung đang hiển thị
trên màn hình (không phải output của lệnh vừa chạy), và timing không đảm bảo — lệnh có thể
chưa xong khi clipboard được đọc.

---

## Giải pháp

### Tổng quan

Thêm method `runCommandWithOutput()` vào IDE interface — dùng **VS Code Shell Integration API**
(`terminal.shellIntegration.executeCommand()`, available từ VS Code 1.93) để capture output
trực tiếp từ terminal WSL. Fallback về cơ chế **sentinel polling** nếu Shell Integration
chưa sẵn sàng.

```
┌─────────────────────────────────────────────────────────────┐
│  runTerminalCommandImpl()                                   │
│      │                                                      │
│      ├── remoteName = "" / "local"                          │
│      │       └── childProcess.spawn() [không đổi]           │
│      │                                                      │
│      ├── remoteName = "wsl"  ← MỚI                          │
│      │       └── ide.runCommandWithOutput()                  │
│      │               │                                      │
│      │               ├── shellIntegration available?        │
│      │               │       └── YES → executeCommand()     │
│      │               │               + read() async stream  │
│      │               │                                      │
│      │               └── shellIntegration unavailable?      │
│      │                       └── sentinel polling via       │
│      │                           sendText + clipboard       │
│      │                                                      │
│      └── remoteName = "ssh-remote" / "dev-container" / ...  │
│              └── fallback cũ [không đổi]                    │
└─────────────────────────────────────────────────────────────┘
```

### Chi tiết implementation

#### Path 1 — Shell Integration (ưu tiên)

VS Code Shell Integration API (OSC 633 markers) cho phép extension:
1. Gửi lệnh vào terminal và nhận `TerminalShellExecution` object
2. Đọc output qua async iterator `execution.read()`
3. Nhận `exitCode` sau khi lệnh hoàn tất

```typescript
const si = (terminal as any).shellIntegration; // cast vì @types/vscode 1.70 chưa có API này
if (si && typeof si.executeCommand === "function") {
  const execution = si.executeCommand(command);
  for await (const chunk of execution.read()) {
    output += chunk;
  }
  return { output: output.trim(), exitCode: execution.exitCode ?? null };
}
```

> **Lưu ý:** Project dùng `@types/vscode@1.70.0` (pre-shellIntegration). Dùng
> `(terminal as any).shellIntegration` để bypass compile-time type check — runtime
> duck-typing kiểm tra sự tồn tại của method trước khi gọi.

#### Path 2 — Sentinel Polling (fallback)

Khi Shell Integration chưa load (terminal mới mở, shell chưa source profile):

1. Gửi lệnh thật vào terminal
2. Gửi thêm lệnh `echo __CONTINUE_DONE_<timestamp>__` làm sentinel
3. Poll clipboard mỗi 300ms, đọc nội dung terminal
4. Dừng khi tìm thấy sentinel trong output
5. Trích xuất output giữa dòng lệnh và dòng sentinel

```typescript
const sentinel = `__CONTINUE_DONE_${Date.now()}__`;
terminal.sendText(`echo ${sentinel}`, true);

// Poll cho đến khi sentinel xuất hiện
while (!content.includes(sentinel) && attempts < maxAttempts) {
  await sleep(pollInterval);
  content = await readTerminalViaClipboard();
}
```

---

## Các file thay đổi

### `core/index.d.ts`

Thêm method signature vào `IDE` interface:

```typescript
runCommandWithOutput(
  command: string,
  timeoutMs?: number,
): Promise<{ output: string; exitCode: number | null }>;
```

### `core/protocol/ide.ts`

Thêm message type vào protocol:

```typescript
runCommandWithOutput: [
  { command: string; timeoutMs?: number },
  { output: string; exitCode: number | null },
];
```

### `core/tools/implementations/runTerminalCommand.ts`

Thêm nhánh xử lý cho `remoteName = "wsl"`:

```typescript
if (ideInfo.remoteName === "wsl") {
  const { output, exitCode } = await extras.ide.runCommandWithOutput(
    command,
    DEFAULT_TOOL_TIMEOUT_MS,
  );
  return [{
    name: "Terminal",
    content: output || "(no output)",
    status: exitCode === 0 || exitCode === null
      ? "Command completed"
      : `Command exited with code ${exitCode}`,
  }];
}
```

### `extensions/vscode/src/VsCodeIde.ts`

Implement `runCommandWithOutput()` với Shell Integration + sentinel fallback.
(Xem chi tiết tại phần **Giải pháp** ở trên.)

### `core/protocol/messenger/messageIde.ts`

Thêm `runCommandWithOutput()` vào `MessageIde` để forward qua IPC:

```typescript
async runCommandWithOutput(command: string, timeoutMs?: number) {
  return await this.request("runCommandWithOutput", { command, timeoutMs });
}
```

### `core/util/filesystem.ts`

Thêm stub no-op vào `FileSystemIde` (dùng trong tests/non-VSCode contexts):

```typescript
runCommandWithOutput(_command: string, _timeoutMs?: number) {
  return Promise.resolve({ output: "", exitCode: null });
}
```

### `extensions/vscode/src/extension/VsCodeMessenger.ts`

Thêm message handler:

```typescript
this.onWebviewOrCore("runCommandWithOutput", async (msg) => {
  return await ide.runCommandWithOutput(msg.data.command, msg.data.timeoutMs);
});
```

---

## Điều kiện hoạt động

| Điều kiện | Shell Integration Path | Sentinel Fallback |
|-----------|----------------------|-------------------|
| VS Code ≥ 1.93 | ✅ Bắt buộc | ✅ |
| Shell Integration enabled (default) | ✅ Bắt buộc | ✅ |
| Terminal profile: bash/zsh | ✅ | ✅ |
| `$TERM_PROGRAM = vscode` | ✅ Verify bằng lệnh này | - |
| Remote WSL (`remoteName = "wsl"`) | ✅ | ✅ |

### Verify Shell Integration đang active

Chạy trong WSL terminal:

```bash
echo $TERM_PROGRAM
# Expected: vscode
```

Nếu output là `vscode` → Shell Integration đang load → Path 1 được dùng (tối ưu nhất).

### Cài đặt VSCode (đã áp dụng)

`settings.json` cần có:

```json
{
  "terminal.integrated.defaultProfile.windows": "Ubuntu-24.04 (WSL)",
  "terminal.integrated.profiles.windows": {
    "Ubuntu-24.04 (WSL)": {
      "path": "C:\\Windows\\System32\\wsl.exe",
      "args": ["-d", "Ubuntu-24.04"],
      "icon": "terminal-ubuntu"
    }
  }
}
```

---

## Scope giới hạn

Patch này **chỉ xử lý `remoteName = "wsl"`**. Các remote environment khác
(`"ssh-remote"`, `"dev-container"`, `"codespaces"`) vẫn dùng fallback cũ —
về lý thuyết có thể áp dụng cùng approach nhưng chưa được test.

> **Cập nhật 2026-10-27:** Patch 13 (`feature/20261026.terminal-remote-ssh`)
> đã mở rộng support cho toàn bộ các remote này. Engine từ patch 10 đã
> remote-agnostic ngay từ đầu — patch 13 chỉ bỏ gate `=== "wsl"` và thêm
> circuit breaker + POSIX wrapper fixes. Xem `.patches/13-ssh-remote-terminal-output-capture.md`.

---

## Upstream status

Vấn đề này được track tại:
- [continuedev/continue#9731](https://github.com/continuedev/continue/issues/9731) —
  "Terminal output not captured when Windows VS Code connects to WSL"
- [continuedev/continue#9679](https://github.com/continuedev/continue/pull/9679) —
  PR fix lỗi `spawn powershell.exe ENOENT` (fix một phần, tạo ra issue #9731)

Upstream chưa có fix chính thức tại thời điểm patch này được tạo (2026-08-26).
Khi upstream merge fix, cần review để tránh conflict với patch này.
