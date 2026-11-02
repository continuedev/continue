# MCP Remote SSH Terminal Server

MCP server giải quyết hạn chế của Continue extension khi làm việc trên **Remote SSH** — built-in `runTerminalCommand` tool không capture được output.

## Vấn đề

Khi Connect VS Code đến remote SSH server, Continue's `runTerminalCommand` tool:
- Chạy lệnh trên remote ✅
- **Không capture output** ❌ (VS Code API `terminal.sendText()` không hỗ trợ)

```
Command executed in remote terminal. Output capture is not yet available for remote environments.
```

## Giải pháp

MCP server này chạy **trên local Mac** (nơi extension host chạy). Nó dùng SSH để execute commands trên remote server và capture stdout/stderr.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Local Mac     │     │   Remote Server │     │   VS Code IDE   │
│                 │     │                 │     │                 │
│  Extension Host │────▶│  SSH Server     │◀────│  Chat Panel     │
│  (MCP Server)   │     │  (devops@...)   │     │                 │
│                 │     │                 │     │                 │
│  child_process  │     │  Shell Process  │     │                 │
│  spawn(ssh)     │     │  (bash -c cmd)  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                         │
        │    SSH connection       │
        └─────────────────────────┘
```

## Cài đặt

### 1. Install dependencies

```bash
cd mcp-remote-ssh
npm install
```

### 2. Config trong Continue

Thêm vào `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: remote-ssh-terminal
    command: /Users/goku-/miniconda3/envs/node20/bin/node
    args:
      - /Users/goku-/.tiep-tuc/mcp-remote-ssh/server.js
    env:
      REMOTE_SSH_HOST: devops@devops-gpu-vt-tpb
```

**Lưu ý**: 
- `REMOTE_SSH_HOST` có thể thay đổi theo remote server của bạn
- SSH key phải đã được setup (không cần password)

### 3. Restart VS Code

Reload window để Continue nhận config mới.

## Sử dụng

Khi làm việc trên remote SSH, model sẽ tự động dùng tool `run_command` từ MCP server này để chạy lệnh và capture output.

### Tool parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | ✅ | Shell command để execute trên remote |
| `cwd` | string | ❌ | Working directory trên remote (default: home) |
| `timeout` | number | ❌ | Timeout ms (default: 120000) |

### Ví dụ

```json
{
  "command": "ls -la /home/devops/projects",
  "cwd": "/home/devops"
}
```

Output:
```
[Remote: devops@devops-gpu-vt-tpb]
[CWD: /home/devops]

total 42
drwxr-xr-x  5 devops devops 4096 Aug 15 10:30 .
drwxr-xr-x 12 devops devops 4096 Aug 10 08:00 ..
drwxr-xr-x  8 devops devops 4096 Aug 14 16:22 my-project
...

[exit code: 0]
```

## Test

```bash
cd mcp-remote-ssh
node test.js
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Mac (goku-)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              VS Code IDE                             │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │              Continue Extension              │   │   │
│  │  │  ┌─────────────────────────────────────┐    │   │   │
│  │  │  │  Extension Host (Local)             │    │   │   │
│  │  │  │  ┌─────────────────────────────┐    │    │   │   │
│  │  │  │  │  MCP Client                  │    │    │   │   │
│  │  │  │  │  (StdioClientTransport)      │    │    │   │   │
│  │  │  │  └──────────────┬──────────────┘    │    │   │   │
│  │  │  │                 │                    │    │   │   │
│  │  │  │                 ▼                    │    │   │   │
│  │  │  │  ┌─────────────────────────────┐    │    │   │   │
│  │  │  │  │  MCP Server (stdio)         │    │    │   │   │
│  │  │  │  │  (server.js)                │    │    │   │   │
│  │  │  │  └──────────────┬──────────────┘    │    │   │   │
│  │  │  │                 │                    │    │   │   │
│  │  │  │                 ▼                    │    │   │   │
│  │  │  │  ┌─────────────────────────────┐    │    │   │   │
│  │  │  │  │  child_process.spawn()      │    │    │   │   │
│  │  │  │  │  (ssh command)              │    │    │   │   │
│  │  │  │  └─────────────────────────────┘    │    │   │   │
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

## So sánh: Built-in Tool vs MCP Server

| Feature | Built-in `runTerminalCommand` | MCP `remote-ssh-terminal` |
|---------|-------------------------------|---------------------------|
| Chạy trên remote | ✅ | ✅ |
| Capture stdout | ❌ | ✅ |
| Capture stderr | ❌ | ✅ |
| Exit code | ❌ | ✅ |
| Timeout | ✅ | ✅ |
| CWD support | ❌ | ✅ |

## Troubleshooting

### "ssh: Could not resolve hostname"

Kiểm tra:
1. `REMOTE_SSH_HOST` trong config đúng
2. Remote server accessible
3. SSH key đã được setup

### "Permission denied (publickey)"

SSH key chưa được setup. Fix:
```bash
ssh-copy-id devops@devops-gpu-vt-tpb
```

### Output bị truncate

Output > 100KB sẽ bị truncate. Đây là intentional để tránh context overflow.

### Timeout

Command chạy quá 2 phút sẽ bị kill. Có thể tăng timeout bằng cách:
```json
{
  "command": "long_running_command",
  "timeout": 300000
}
```

## Files

```
mcp-remote-ssh/
├── server.js       # MCP server (main file)
├── test.js         # Test script
├── package.json    # Dependencies
└── README.md       # This file
```
