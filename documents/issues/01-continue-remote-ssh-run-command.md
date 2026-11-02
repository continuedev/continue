# Issue: Continue Extension Không Capture Output Khi Chạy Command Trên Remote SSH

## 📋 Summary

**Issue**: Continue extension's built-in `runTerminalCommand` tool không thể capture output khi làm việc trên Remote SSH environment.

**Status**: 🔴 **UNRESOLVED — In Progress** (updated 2026-08-20)

**Goal**: Fix built-in `runTerminalCommand` tool để capture output trên remote SSH, thay vì trả về placeholder message.

**Workarounds (tạm thời)**: 2 MCP servers đã được tạo (`mcp-remote-ssh/`, `mcp-remote-terminal/`) nhưng chưa được deploy/test.

---

## 🎯 Problem Statement

### Hiện tượng

Khi user làm việc trên Remote SSH workspace và yêu cầu model chạy command:

```
User: "Run `ls -la /home/devops` and show me the output"

Model: "Command executed in remote terminal. Output capture is not yet available for remote environments."
```

**Vấn đề**: 
- ✅ Command được execute trên remote
- ❌ Output KHÔNG được capture và trả về cho model
- ❌ Model không thể đọc kết quả để tiếp tục conversation

### Impact

- Model không thể debug remote server
- Model không thể verify kết quả sau khi chạy command
- User phải manually copy-paste output từ terminal vào chat
- Giảm hiệu suất làm việc trên remote environment

---

## 🔍 Root Cause Analysis

### 1. VS Code API Limitation

Continue extension sử dụng VS Code API `terminal.sendText()` để chạy command trên remote:

```typescript
// extensions/vscode/src/VsCodeIde.ts
async runCommand(command: string): Promise<void> {
  const terminal = this.getOrCreateTerminal();
  terminal.sendText(command, false); // ❌ Không capture output
}
```

**Vấn đề**: 
- `terminal.sendText()` chỉ gửi command đến terminal
- VS Code API **không có method** để capture output từ terminal
- Output được hiển thị trong VS Code terminal UI, nhưng không accessible qua API

### 2. Extension Host Architecture

Khi làm việc trên Remote SSH:

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Mac (goku-)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              VS Code IDE                             │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Extension Host (Local)                     │   │   │
│  │  │  - Continue Extension                       │   │   │
│  │  │  - runTerminalCommand tool                  │   │   │
│  │  │  - MCP Client                               │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ SSH
┌─────────────────────────────────────────────────────────────┐
│                    Remote Server (devops@devops-gpu-vt-tpb)  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              VS Code Server                          │   │
│  │  - Terminal (display output)                        │   │
│  │  - Filesystem                                       │   │
│  │  - Shell processes                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Vấn đề**: 
- Extension host chạy trên **local Mac**
- Terminal chạy trên **remote server**
- Không có cách để extension host capture output từ remote terminal

### 3. Why Built-in Tool Fails

```typescript
// core/tools/implementations/runTerminalCommand.ts (line ~100)
const LOCAL_ONLY = ["", "local"];

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  const command = getStringArg(args, "command");
  const waitForCompletion = getBooleanArg(args, "waitForCompletion", false) ?? true;

  const ideInfo = await extras.ide.getIdeInfo();

  if (LOCAL_ONLY.includes(ideInfo.remoteName)) {
    // ✅ LOCAL: child_process.spawn() — capture stdout/stderr
    // ... (full implementation with streaming, timeout, etc.)
  }

  // ❌ REMOTE: delegate to VS Code terminal — NO output capture
  await extras.ide.runCommand(command);
  return [
    {
      name: "Terminal",
      description: "Terminal command output",
      content:
        "Command executed in remote terminal. Output capture is not yet available for remote environments.",
      status: "Command executed",
    },
  ];
};
```

**Comment trong code (line ~95)**:
```typescript
// Only spawn processes locally when there is no remote workspace.
// With extensionKind: ["ui", "workspace"], the extension host almost always
// runs on the local machine. childProcess.spawn() executes on the extension
// host, so for any remote workspace it would run commands on the wrong machine
// (or fail with ENOENT when the local shell doesn't match the remote OS).
// All remote types delegate to ide.runCommand() which routes through VS Code's
// integrated terminal and executes in the correct remote environment.
```

**⚠️ Comment này CŨ — cần verify lại**:
- Comment nói "extension host almost always runs on the local machine"
- Nhưng với `extensionKind: ["ui", "workspace"]`, VS Code **thường** chạy extension host trên **remote**
- Nếu extension host chạy trên remote, `child_process.spawn()` sẽ chạy trên remote (đúng chỗ)
- **Cần test**: Verify extension host thực sự chạy ở đâu khi Remote SSH

### 4. Existing `CapturedTerminal` (Commented Out)

```typescript
// extensions/vscode/src/terminal/terminalEmulator.ts (line 1)
/* Terminal emulator - commented because node-pty is causing problems. */
```

**Class `CapturedTerminal`** đã tồn tại nhưng bị comment out:
- Dùng `node-pty` để tạo pseudo-terminal
- Có `runCommand()` method với output capture
- Dùng `vscode.Pseudoterminal` API để tạo custom terminal
- **Vấn đề**: `node-pty` gây problems (native module, build issues)

```typescript
// extensions/vscode/src/terminal/terminalEmulator.ts
export class CapturedTerminal {
  async runCommand(command: string): Promise<string> {
    // ... queue management
    this.terminal.sendText(command);
    const output = await this.waitForCommandToFinish();
    return output; // ✅ Captures output!
  }

  private async waitForCommandToFinish() {
    return new Promise<string>((resolve, reject) => {
      this.onDataListeners.push((data: any) => {
        const strippedData = stripAnsi(data);
        this.dataBuffer += strippedData;
        if (this.dataEndsInPrompt(strippedData)) {
          resolve(this.dataBuffer); // ✅ Output captured
          this.dataBuffer = "";
          this.onDataListeners = [];
        }
      });
    });
  }
}
```

**Tại sao bị comment out**: `node-pty` là native module, gây build issues trên một số platforms.

---

## 📁 Source Code Map

### Files liên quan đến issue

| File | Role | Key Code |
|------|------|----------|
| `core/tools/implementations/runTerminalCommand.ts` | Tool implementation | `LOCAL_ONLY` check, remote fallback (line ~100) |
| `extensions/vscode/src/VsCodeIde.ts` | VS Code IDE adapter | `runCommand()` method (line ~295) |
| `extensions/vscode/src/terminal/terminalEmulator.ts` | CapturedTerminal (commented) | `CapturedTerminal` class, `node-pty` |
| `core/index.d.ts` | IDE interface | `runCommand(): Promise<void>` (line ~470) |
| `core/protocol/ide.ts` | Protocol definition | `runCommand: [{ command, options }, void]` |
| `core/protocol/messenger/messageIde.ts` | Message proxy | `runCommand()` → `this.request("runCommand", ...)` |
| `extensions/vscode/package.json` | Extension manifest | `extensionKind: ["ui", "workspace"]` |

### Call chain

```
Model calls runTerminalCommand tool
  → core/tools/implementations/runTerminalCommand.ts:runTerminalCommandImpl()
    → extras.ide.getIdeInfo() → checks remoteName
    → if LOCAL_ONLY: child_process.spawn() → capture output ✅
    → if REMOTE: extras.ide.runCommand(command)
      → core/protocol/messenger/messageIde.ts:runCommand()
        → this.request("runCommand", { command, options })
          → extensions/vscode/src/VsCodeIde.ts:runCommand()
            → terminal.sendText(command, false) → NO output capture ❌
```

### IDE Interface (core/index.d.ts)

```typescript
export interface IDE {
  // ... other methods ...
  runCommand(command: string, options?: TerminalOptions): Promise<void>;
  // ... other methods ...
}

export interface TerminalOptions {
  reuseTerminal?: boolean;
  terminalName?: string;
  waitForCompletion?: boolean;
}
```

**⚠️ `runCommand()` trả về `Promise<void>` — KHÔNG có output!**

### Protocol (core/protocol/ide.ts)

```typescript
export type ToIdeFromWebviewOrCoreProtocol = {
  // ... other methods ...
  runCommand: [{ command: string; options?: TerminalOptions }, void];
  // ... other methods ...
};
```

**⚠️ Protocol trả về `void` — KHÔNG có output!**

---

## 💡 Solution Options

### Option A: Fix `runCommand()` để capture output (RECOMMENDED)

**Approach**: Modify `VsCodeIde.runCommand()` để capture output từ terminal.

**Challenge**: VS Code API `vscode.Terminal` không có method để capture output.

**Possible approaches**:

1. **Dùng `vscode.Pseudoterminal` API** (tương tự `CapturedTerminal` đã có)
   - Tạo custom terminal với `vscode.window.createTerminal({ pty })`
   - Capture output qua `onDidWrite` event
   - **Problem**: Cần `node-pty` (native module, build issues)

2. **Dùng `child_process.spawn()` trực tiếp** (nếu extension host chạy trên remote)
   - Verify extension host chạy trên remote (với `extensionKind: ["ui", "workspace"]`)
   - Nếu đúng, dùng `child_process.spawn()` như local path
   - **Advantage**: Không cần `node-pty`, không cần VS Code terminal
   - **Risk**: Cần verify extension host location

3. **Dùng `vscode.window.createTerminal()` + polling**
   - Tạo terminal, send command
   - Poll terminal output qua `vscode.window.activeTerminal`
   - **Problem**: VS Code API không expose terminal output

4. **Dùng `vscode.commands.executeCommand("workbench.action.terminal.sendSequence")`**
   - Execute command qua VS Code command
   - **Problem**: Vẫn không capture output

**Best approach**: **Option 2** — Verify extension host location, nếu chạy trên remote thì dùng `child_process.spawn()` trực tiếp.

### Option B: MCP Server Workaround (TEMPORARY)

**Approach**: Tạo MCP server chạy trên remote, dùng `child_process.spawn()` để capture output.

**2 MCP servers đã được tạo**:

#### 1. `mcp-remote-terminal/` (chạy trên remote)

- Chạy trên remote server (nơi extension host chạy)
- Dùng `child_process.spawn()` trực tiếp
- Capture stdout/stderr
- **Status**: Created, chưa deploy/test

#### 2. `mcp-remote-ssh/` (chạy trên local, SSH đến remote)

- Chạy trên local Mac
- Dùng `ssh` command để execute trên remote
- Capture stdout/stderr từ SSH
- **Status**: Created, chưa deploy/test

**⚠️ Vấn đề với Option B**:
- MCP server là workaround, không fix root cause
- Cần deploy MCP server lên remote (hoặc local)
- Cần config trong `~/.continue/config.yaml`
- Không integrate với built-in tool (model phải gọi MCP tool thay vì built-in)

### Option C: Hybrid — Fix built-in + MCP fallback

**Approach**:
1. Fix built-in `runTerminalCommand` để capture output trên remote (Option A)
2. Giữ MCP servers như fallback cho edge cases

**Steps**:
1. Verify extension host location trên remote SSH
2. Nếu extension host chạy trên remote: dùng `child_process.spawn()` trong `runTerminalCommandImpl()`
3. Update `IDE.runCommand()` interface để trả về output
4. Update protocol để truyền output
5. Test trên remote SSH

---

## 🔬 Investigation Steps (TODO)

### Step 1: Verify Extension Host Location

**Question**: Khi Remote SSH, extension host chạy trên local hay remote?

**Test**:
```typescript
// Thêm vào VsCodeIde.ts hoặc runTerminalCommand.ts
const ideInfo = await extras.ide.getIdeInfo();
console.log("Remote name:", ideInfo.remoteName);
console.log("Platform:", process.platform);
console.log("Hostname:", os.hostname());
console.log("Home:", process.env.HOME);
```

**Expected**:
- Nếu extension host chạy trên remote: `hostname` = remote hostname, `HOME` = `/home/devops`
- Nếu extension host chạy trên local: `hostname` = local Mac hostname, `HOME` = `/Users/goku-`

### Step 2: Test `child_process.spawn()` trên Remote

**Test**:
```typescript
// Trong runTerminalCommandImpl(), trước khi check LOCAL_ONLY
const testResult = await new Promise((resolve) => {
  const child = childProcess.spawn("echo", ["test from extension host"], {
    shell: true,
  });
  let output = "";
  child.stdout.on("data", (data) => output += data.toString());
  child.on("close", () => resolve(output));
});
console.log("child_process test:", testResult);
```

**Expected**:
- Nếu extension host chạy trên remote: output = "test from extension host\n" (chạy trên remote)
- Nếu extension host chạy trên local: output = "test from extension host\n" (chạy trên local)

**⚠️ Test này không phân biệt được local/remote — cần check hostname**

### Step 3: Modify `runCommand()` để Capture Output

**Nếu extension host chạy trên remote**:

```typescript
// core/tools/implementations/runTerminalCommand.ts
export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  const command = getStringArg(args, "command");
  const waitForCompletion = getBooleanArg(args, "waitForCompletion", false) ?? true;

  const ideInfo = await extras.ide.getIdeInfo();

  // ✅ NEW: Check if extension host is on the same machine as workspace
  // If yes, use child_process.spawn() (works for both local and remote)
  const isExtensionHostOnWorkspace = await checkExtensionHostLocation(extras.ide);

  if (isExtensionHostOnWorkspace) {
    // Use child_process.spawn() — capture stdout/stderr
    // (same as local path)
    return executeWithSpawn(command, waitForCompletion, extras);
  }

  // Fallback: use VS Code terminal (no output capture)
  await extras.ide.runCommand(command);
  return [
    {
      name: "Terminal",
      description: "Terminal command output",
      content: "Command executed in remote terminal. Output capture not available.",
      status: "Command executed",
    },
  ];
};
```

### Step 4: Update IDE Interface (nếu cần)

```typescript
// core/index.d.ts
export interface IDE {
  // ... other methods ...
  runCommand(command: string, options?: TerminalOptions): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
  // ... other methods ...
}
```

**⚠️ Breaking change** — cần update tất cả callers.

---

## 💡 Solution: MCP Remote SSH Terminal Server (Workaround)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Mac (goku-)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              VS Code IDE                             │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Extension Host (Local)                     │   │   │
│  │  │  ┌─────────────────────────────────────┐    │   │   │
│  │  │  │  MCP Client                          │    │   │   │
│  │  │  │  (StdioClientTransport)              │    │   │   │
│  │  │  └──────────────┬──────────────────────┘    │   │   │
│  │  │                 │                            │   │   │
│  │  │                 ▼                            │   │   │
│  │  │  ┌─────────────────────────────────────┐    │   │   │
│  │  │  │  MCP Server (stdio)                 │    │   │   │
│  │  │  │  (server.js)                        │    │   │   │
│  │  │  └──────────────┬──────────────────────┘    │   │   │
│  │  │                 │                            │   │   │
│  │  │                 ▼                            │   │   │
│  │  │  ┌─────────────────────────────────────┐    │   │   │
│  │  │  │  child_process.spawn()              │    │   │   │
│  │  │  │  (ssh command)                      │    │   │   │
│  │  │  └─────────────────────────────────────┘    │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ SSH
┌─────────────────────────────────────────────────────────────┐
│                    Remote Server (devops@devops-gpu-vt-tpb)  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SSH Server                              │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Shell Process (bash -c "command")          │   │   │
│  │  │  - stdout ──────────────────────────────────┼───┼───▶
│  │  │  - stderr ──────────────────────────────────┼───┼───▶
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

1. **User** yêu cầu model chạy command trên remote
2. **Model** gọi tool `run_command` từ MCP server
3. **MCP Server** (chạy trên local Mac) nhận command
4. **MCP Server** execute `ssh devops@devops-gpu-vt-tpb "command"`
5. **SSH** connect đến remote server và chạy command
6. **Remote shell** execute command và output stdout/stderr
7. **SSH** capture output và trả về local
8. **MCP Server** parse output và trả về cho model
9. **Model** đọc output và tiếp tục conversation

### Key Features

| Feature | Description |
|---------|-------------|
| **Capture stdout** | ✅ Capture toàn bộ output từ remote |
| **Capture stderr** | ✅ Capture error messages |
| **Exit code** | ✅ Trả về exit code của command |
| **Timeout** | ✅ Default 2 phút, có thể customize |
| **CWD support** | ✅ Chạy command trong directory cụ thể |
| **Output truncation** | ✅ Truncate output > 100KB để tránh context overflow |
| **Color disable** | ✅ Disable ANSI colors cho output cleaner |

---

## 📁 Implementation

### File Structure

```
~/.tiep-tuc/mcp-remote-ssh/
├── server.js       # MCP server (main file)
├── test.js         # Test script
├── package.json    # Dependencies
└── README.md       # Documentation
```

### Key Code: `server.js`

```javascript
const { spawn } = require("node:child_process");

// Remote SSH configuration
const REMOTE_HOST = process.env.REMOTE_SSH_HOST || "devops@devops-gpu-vt-tpb";
const REMOTE_SSH_OPTIONS = [
  "-o", "ConnectTimeout=10",
  "-o", "StrictHostKeyChecking=no",
  "-o", "BatchMode=yes",
];

function executeRemoteCommand(command, cwd, timeoutMs) {
  return new Promise((resolve) => {
    // Build SSH command
    const sshCommand = cwd 
      ? `cd '${cwd}' && ${command}`
      : command;
    
    const sshArgs = [
      ...REMOTE_SSH_OPTIONS,
      REMOTE_HOST,
      sshCommand,
    ];

    const child = spawn("ssh", sshArgs, {
      cwd: os.homedir(),
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code, signal) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        signal: signal || undefined,
        remoteHost: REMOTE_HOST,
      });
    });
  });
}
```

### MCP Tool Definition

```javascript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_command",
      description:
        "Execute a shell command on the remote SSH server and capture stdout/stderr. " +
        `Remote host: ${REMOTE_HOST}`,
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute on the remote server",
          },
          cwd: {
            type: "string",
            description: "Working directory on the remote server (optional)",
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (optional, defaults to 120000)",
          },
        },
        required: ["command"],
      },
    },
  ],
}));
```

---

## ⚙️ Configuration

### `~/.tiep-tuc/config.yaml`

```yaml
mcpServers:
  # Remote SSH Terminal — capture output khi làm việc trên Remote SSH
  # Built-in runTerminalCommand KHÔNG capture được output trên remote
  # MCP server chạy trên local Mac (extension host), dùng SSH để chạy command trên remote
  # Capture stdout/stderr từ remote server
  - name: remote-ssh-terminal
    command: /Users/goku-/miniconda3/envs/node20/bin/node
    args:
      - /Users/goku-/.tiep-tuc/mcp-remote-ssh/server.js
    env:
      REMOTE_SSH_HOST: devops@devops-gpu-vt-tpb
```

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `REMOTE_SSH_HOST` | ✅ | SSH host (user@hostname) | `devops@devops-gpu-vt-tpb` |

### Requirements

- **SSH key** phải đã được setup (không cần password)
- **Remote server** phải accessible từ local Mac
- **Node.js** v20+ phải được install trên local Mac

---

## 🧪 Testing

### Test Script

```bash
cd ~/.tiep-tuc/mcp-remote-ssh
node test.js
```

### Test Results (2025-08-20)

```
=== MCP Remote SSH Terminal Server Test ===

[1] Testing initialize...
    Server: remote-ssh-terminal
    Protocol: 2024-11-05
[1] Initialize: OK

[2] Testing tools/list...
    Tools: ["run_command"]
[2] List tools: OK

[3] Testing run_command with 'echo'...
    Output: Hello from remote SSH!
[3] Run 'echo': OK

[4] Testing run_command with 'whoami && hostname'...
    Output: devops | 09a3335f-f01e-438a-be47-64b3d4d3fa3f | /home/devops
[4] Run 'whoami': OK

[5] Testing error case (ls /nonexistent)...
    Error captured: OK
[5] Error case: OK

[6] Testing run_command with cwd=/tmp...
    CWD: /tmp (correct)
[6] CWD test: OK

=== All tests completed! ===
```

**Result**: ✅ 6/6 tests passed

---

## 📊 Comparison: Built-in Tool vs MCP Server

| Feature | Built-in `runTerminalCommand` | MCP `remote-ssh-terminal` |
|---------|-------------------------------|---------------------------|
| Chạy trên remote | ✅ | ✅ |
| Capture stdout | ❌ | ✅ |
| Capture stderr | ❌ | ✅ |
| Exit code | ❌ | ✅ |
| Timeout | ✅ | ✅ |
| CWD support | ❌ | ✅ |
| Output truncation | ❌ | ✅ (100KB) |
| Color disable | ❌ | ✅ |

---

## 🐛 Known Issues & Limitations

### 1. SSH Connection Overhead

**Issue**: Mỗi lần chạy command phải establish SSH connection mới.

**Impact**: 
- Slow hơn so với local execution
- Có thể timeout nếu remote server slow

**Workaround**: 
- Tăng timeout: `{"command": "...", "timeout": 300000}`
- Dùng SSH multiplexing (tương lai)

### 2. No Interactive Commands

**Issue**: Không thể chạy interactive commands (ví dụ: `vim`, `top`, `htop`).

**Reason**: SSH không support interactive TTY qua MCP protocol.

**Workaround**: 
- Dùng non-interactive commands
- Chạy interactive commands manually trong VS Code terminal

### 3. Output Size Limit

**Issue**: Output > 100KB sẽ bị truncate.

**Reason**: Tránh context overflow cho LLM.

**Workaround**: 
- Dùng `head`, `tail`, `grep` để filter output
- Chạy command multiple lần với different parameters

### 4. Single Remote Host

**Issue**: Chỉ support một remote host per MCP server instance.

**Reason**: Config đơn giản, dễ quản lý.

**Workaround**: 
- Tạo multiple MCP server instances với different `REMOTE_SSH_HOST`
- Ví dụ:
  ```yaml
  mcpServers:
    - name: remote-ssh-tpb
      env:
        REMOTE_SSH_HOST: devops@devops-gpu-vt-tpb
    - name: remote-ssh-other
      env:
        REMOTE_SSH_HOST: devops@devops-gpu-vt-other
  ```

---

## 🔧 Troubleshooting

### "ssh: Could not resolve hostname"

**Cause**: `REMOTE_SSH_HOST` sai hoặc remote server không accessible.

**Fix**:
```bash
# Kiểm tra hostname
ping devops-gpu-vt-tpb

# Kiểm tra SSH connection
ssh devops@devops-gpu-vt-tpb "echo 'SSH OK'"
```

### "Permission denied (publickey)"

**Cause**: SSH key chưa được setup.

**Fix**:
```bash
# Copy SSH public key đến remote
ssh-copy-id devops@devops-gpu-vt-tpb

# Verify
ssh devops@devops-gpu-vt-tpb "whoami"
```

### "Command timed out"

**Cause**: Command chạy quá 2 phút (default timeout).

**Fix**:
```json
{
  "command": "long_running_command",
  "timeout": 300000
}
```

### "Output is empty"

**Cause**: Command không có output, hoặc output bị redirect.

**Fix**:
```bash
# Kiểm tra command có output không
ssh devops@devops-gpu-vt-tpb "command"

# Nếu output bị redirect, dùng 2>&1
ssh devops@devops-gpu-vt-tpb "command 2>&1"
```

---

## 📝 Usage Examples

### Basic Command

```json
{
  "command": "ls -la /home/devops"
}
```

**Output**:
```
[Remote: devops@devops-gpu-vt-tpb]
[CWD: (home directory)]

total 42
drwxr-xr-x  5 devops devops 4096 Aug 15 10:30 .
drwxr-xr-x 12 devops devops 4096 Aug 10 08:00 ..
drwxr-xr-x  8 devops devops 4096 Aug 14 16:22 my-project
...

[exit code: 0]
```

### With CWD

```json
{
  "command": "ls -la",
  "cwd": "/home/devops/projects"
}
```

### With Timeout

```json
{
  "command": "sleep 10 && echo 'Done'",
  "timeout": 30000
}
```

### Capture Errors

```json
{
  "command": "ls /nonexistent/path"
}
```

**Output**:
```
[Remote: devops@devops-gpu-vt-tpb]
[CWD: (home directory)]

[stderr]
ls: cannot access '/nonexistent/path': No such file or directory

[exit code: 2]
```

### System Information

```json
{
  "command": "uname -a && hostname && whoami && pwd"
}
```

**Output**:
```
[Remote: devops@devops-gpu-vt-tpb]
[CWD: (home directory)]

Linux 09a3335f-f01e-438a-be47-64b3d4d3fa3f 5.15.0-105-generic #115-Ubuntu SMP Mon Apr 15 09:50:01 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
09a3335f-f01e-438a-be47-64b3d4d3fa3f
devops
/home/devops

[exit code: 0]
```

---

## 🔄 Future Enhancements

### 1. SSH Multiplexing

**Goal**: Reuse SSH connection để giảm overhead.

**Implementation**:
```bash
# SSH config (~/.ssh/config)
Host devops-gpu-vt-tpb
  ControlMaster auto
  ControlPath ~/.ssh/sockets/%r@%h-%p
  ControlPersist 600
```

### 2. Multiple Remote Hosts

**Goal**: Support multiple remote servers trong một MCP server.

**Implementation**:
```javascript
// Dynamic host selection
const { command, host, cwd, timeout } = request.params.arguments;
const targetHost = host || REMOTE_HOST;
```

### 3. File Transfer

**Goal**: Upload/download files qua MCP.

**Implementation**:
```javascript
// New tools: upload_file, download_file
// Use scp or sftp
```

### 4. Real-time Output Streaming

**Goal**: Stream output real-time cho long-running commands.

**Implementation**:
```javascript
// Use MCP streaming protocol
// Send partial output as it arrives
```

### 5. Command History & Session

**Goal**: Track command history, maintain session state.

**Implementation**:
```javascript
// Store command history in memory
// Support session-based commands
```

---

## 📚 References

- [Continue Extension Documentation](https://docs.continue.dev/)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [VS Code Remote SSH](https://code.visualstudio.com/docs/remote/ssh)
- [SSH Multiplexing Guide](https://www.ssh.com/ssh/multiplexing)

---

## 📅 Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-08-20 | 1.0.0 | Initial release - MCP Remote SSH Terminal Server |
| 2026-08-20 | 2.0.0 | **Update**: Status → UNRESOLVED, thêm source code map, solution options, investigation steps, MCP servers details |

---

## ✅ Current Status (2026-08-20)

### Completed

- ✅ Root cause analysis
- ✅ Solution design (3 options)
- ✅ MCP server implementation (2 servers)
- ✅ Source code map
- ✅ Documentation

### In Progress

- 🔴 Verify extension host location trên remote SSH
- 🔴 Test `child_process.spawn()` trên remote
- 🔴 Fix built-in `runTerminalCommand` để capture output

### Not Started

- ⬜ Deploy MCP servers (workaround)
- ⬜ Test MCP servers
- ⬜ Update IDE interface (nếu cần)
- ⬜ Update protocol (nếu cần)

### Next Steps

1. **Verify**: Extension host location trên remote SSH (Step 1)
2. **Test**: `child_process.spawn()` trên remote (Step 2)
3. **Implement**: Fix built-in tool (Step 3)
4. **Update**: IDE interface + protocol (Step 4)
5. **Test**: End-to-end trên remote SSH
6. **Deploy**: MCP servers như fallback (nếu cần)

---

## 📞 Contact

**Issue reported by**: goku-
**Status**: In Progress
**Last updated**: 2026-08-20
