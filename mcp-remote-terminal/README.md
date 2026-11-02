# MCP Remote Terminal Server

MCP server giải quyết hạn chế của Continue extension khi làm việc trên **Remote SSH** — built-in `runTerminalCommand` tool không capture được output.

## Vấn đề

Khi Connect VS Code đến remote SSH server, Continue's `runTerminalCommand` tool:
- Chạy lệnh trên remote ✅
- **Không capture output** ❌ (VS Code API `terminal.sendText()` không hỗ trợ)

```
Command executed in remote terminal. Output capture is not yet available for remote environments.
```

## Giải pháp

MCP server này chạy **trên remote** (vì `extensionKind: ["ui", "workspace"]` → extension host chạy trên remote). Nó dùng `child_process.spawn()` trực tiếp để capture stdout/stderr.

```mermaid
sequenceDiagram
    participant M as LLM Model
    participant C as Continue Core<br/>(Extension Host)
    participant S as MCP Server<br/>(stdio, trên Remote)
    participant P as Shell Process<br/>(child_process)

    M->>C: Tool call: run_command
    C->>S: MCP tools/call (stdio)
    S->>P: spawn(shell, ["-l", "-c", command])
    P-->>S: stdout + stderr
    S-->>C: MCP response (text output)
    C-->>M: ContextItem (output)
```

## Cài đặt

### 1. Copy folder lên remote server

```bash
# Trên local Mac:
scp -r mcp-remote-terminal/ devops@your-remote-server:~/mcp-remote-terminal/

# Hoặc nếu remote có git:
# Push lên git rồi pull trên remote
```

### 2. Install dependencies trên remote

```bash
ssh devops@your-remote-server
cd ~/mcp-remote-terminal
npm install
```

> **Lưu ý**: Nếu remote không có internet, copy `node_modules` từ local hoặc dùng fallback path (server.js đã có fallback đến `../core/node_modules/`).

### 3. Config trong Continue

Thêm vào `~/.continue/config.yaml` (trên **local Mac**):

```yaml
mcpServers:
  - name: remote-terminal
    command: node
    args:
      - /home/devops/mcp-remote-terminal/server.js
```

> **Path** phải là path **trên remote** (nơi extension host chạy).

### 4. Restart VS Code

Reload window để Continue nhận config mới.

## Sử dụng

Khi làm việc trên remote SSH, model sẽ tự động dùng tool `run_command` từ MCP server này để chạy lệnh và capture output.

### Tool parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | ✅ | Shell command để execute |
| `cwd` | string | ❌ | Working directory (default: home) |
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
total 42
drwxr-xr-x  5 devops devops 4096 Aug 15 10:30 .
drwxr-xr-x 12 devops devops 4096 Aug 10 08:00 ..
drwxr-xr-x  8 devops devops 4096 Aug 14 16:22 my-project
...

[exit code: 0]
```

## Test

```bash
cd mcp-remote-terminal
node test.js
```

## Architecture

```mermaid
graph TB
    subgraph Local["🖥️ Local Mac (goku-)"]
        VSCode["VS Code IDE"]
        Config["~/.continue/config.yaml<br/>(mcpServers config)"]
    end

    subgraph Remote["🖧 Remote SSH Server (devops@devops-gpu-vt-tpb)"]
        subgraph ExtHost["Extension Host (chạy trên Remote)"]
            Core["Continue Core<br/>callTool()"]
            MCPClient["MCP Client<br/>(StdioClientTransport)"]
        end

        subgraph MCPServer["MCP Remote Terminal Server"]
            Server["server.js<br/>(stdio)"]
            Spawn["child_process.spawn()<br/>capture stdout/stderr"]
        end

        FS["Remote Filesystem<br/>/home/devops/mcp-remote-terminal/"]
    end

    VSCode -->|"SSH tunnel"| ExtHost
    Config -.->|"load config"| Core
    Core -->|"MCP protocol<br/>(stdio)"| MCPClient
    MCPClient -->|"spawn process"| Server
    Server --> Spawn
    Spawn -->|"read/write"| FS

    style Local fill:#e3f2fd,stroke:#1976d2
    style Remote fill:#fff3e0,stroke:#f57c00
    style ExtHost fill:#e8f5e9,stroke:#388e3c
    style MCPServer fill:#fce4ec,stroke:#c2185b
```

### So sánh: Built-in Tool vs MCP Server

```mermaid
graph LR
    subgraph BuiltIn["❌ Built-in runTerminalCommand (Remote)"]
        A1["Model"] --> A2["Continue Core"]
        A2 --> A3["ide.runCommand()"]
        A3 --> A4["terminal.sendText()"]
        A4 --> A5["VS Code Terminal"]
        A5 -.->|"❌ No output capture"| A2
    end

    subgraph MCP["✅ MCP Remote Terminal Server"]
        B1["Model"] --> B2["Continue Core"]
        B2 --> B3["MCP Client"]
        B3 --> B4["MCP Server (stdio)"]
        B4 --> B5["child_process.spawn()"]
        B5 -->|"✅ stdout + stderr"| B4
        B4 -->|"output"| B2
    end

    style BuiltIn fill:#ffebee,stroke:#c62828
    style MCP fill:#e8f5e9,stroke:#2e7d32
```

## Troubleshooting

### "Failed to load MCP SDK"

Server không tìm thấy `@modelcontextprotocol/sdk`. Fix:
```bash
cd ~/mcp-remote-terminal
npm install @modelcontextprotocol/sdk
```

### "Command not found" khi config

Kiểm tra:
1. Path trong config đúng (path trên remote, không phải local)
2. `node` có trong PATH trên remote
3. File `server.js` tồn tại trên remote

### Output bị truncate

Output > 100KB sẽ bị truncate. Đây là intentional để tránh context overflow.

## Files

```
mcp-remote-terminal/
├── server.js       # MCP server (main file)
├── test.js         # Test script
├── package.json    # Dependencies
└── README.md       # This file
```
