# MCP Remote Terminal Server — Installation Summary

## ✅ Đã hoàn thành (2025-08-20)

### 1. Remote Server Setup

**Server**: `devops@devops-gpu-vt-tpb` (Ubuntu 24.04)

**Conda env**: `node20` (Node.js v20.20.2)
```bash
# Conda path trên remote
/data/dev/miniconda3/envs/node20/bin/node
/data/dev/miniconda3/envs/node20/bin/npm
```

**MCP Server location**: `~/mcp-remote-terminal/`
```
/home/devops/mcp-remote-terminal/
├── server.js       # MCP server (đã fix PATH injection)
├── test.js         # Test script (6/6 tests passed)
├── package.json    # Dependencies
├── README.md       # Documentation
└── node_modules/   # Installed dependencies (93 packages)
```

### 2. Config.yaml Update

**File**: `~/.tiep-tuc/config.yaml` (symlink to `~/.continue/config.yaml`)

**Thêm vào `mcpServers` section** (line 508-523):
```yaml
mcpServers:
  # ... existing Context7 config ...

  # Remote Terminal — capture output khi làm việc trên Remote SSH
  # Built-in runTerminalCommand KHÔNG capture được output trên remote
  # MCP server chạy trên remote (extension host), dùng child_process.spawn()
  - name: remote-terminal
    command: /data/dev/miniconda3/envs/node20/bin/node
    args:
      - /home/devops/mcp-remote-terminal/server.js
```

### 3. Server.js Fix

**Vấn đề**: `server.js` gọi `spawn("node", ...)` nhưng `node` không trong PATH trên remote.

**Fix**: Thêm PATH injection vào `executeCommand()`:
```javascript
// Build env with PATH that includes common node/conda locations
const extraPaths = [
  "/data/dev/miniconda3/envs/node20/bin",
  "/data/dev/miniconda3/bin",
  "/usr/local/sbin",
  "/usr/local/bin",
  "/usr/sbin",
  "/usr/bin",
  "/sbin",
  "/bin",
].join(":");

const child = spawn(shell, args, {
  cwd: cwd || os.homedir(),
  env: {
    ...process.env,
    PATH: `${process.env.PATH || ""}:${extraPaths}`,
    FORCE_COLOR: "0",
    NO_COLOR: "1",
  },
});
```

### 4. Testing

**Test trên remote** (all 6 tests passed):
```bash
ssh devops@devops-gpu-vt-tpb
cd ~/mcp-remote-terminal
/data/dev/miniconda3/envs/node20/bin/node test.js
```

**Kết quả**:
- ✅ Initialize: OK
- ✅ List tools: OK (tool: `run_command`)
- ✅ Run 'echo': OK
- ✅ Run 'whoami && hostname && pwd': OK
- ✅ Run 'ls /nonexistent' (error test): OK
- ✅ Run 'pwd' with cwd=/tmp: OK

## 📝 Usage

### Khi làm việc trên Remote SSH

1. **Connect VS Code** đến remote server
2. **Open workspace** trên remote
3. **Ask model** to run a command — model sẽ tự động dùng tool `run_command` từ MCP server

### Tool Parameters

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

## 🔧 Troubleshooting

### "Failed to load MCP SDK"
```bash
ssh devops@devops-gpu-vt-tpb
cd ~/mcp-remote-terminal
/data/dev/miniconda3/envs/node20/bin/npm install @modelcontextprotocol/sdk
```

### "Command not found" khi config
Kiểm tra:
1. Path trong config đúng: `/data/dev/miniconda3/envs/node20/bin/node`
2. File `server.js` tồn tại: `/home/devops/mcp-remote-terminal/server.js`
3. `node_modules` đã install: `ls ~/mcp-remote-terminal/node_modules`

### Output bị truncate
Output > 100KB sẽ bị truncate (intentional để tránh context overflow).

## 🔄 Maintenance

### Update server.js
```bash
# Trên local Mac
cd /Users/goku-/03-Sources/continue-src/mcp-remote-terminal
scp server.js devops@devops-gpu-vt-tpb:~/mcp-remote-terminal/server.js
```

### Reinstall dependencies
```bash
ssh devops@devops-gpu-vt-tpb
cd ~/mcp-remote-terminal
/data/dev/miniconda3/envs/node20/bin/npm install
```

### Test
```bash
ssh devops@devops-gpu-vt-tpb
cd ~/mcp-remote-terminal
/data/dev/miniconda3/envs/node20/bin/node test.js
```

## 📚 Related Files

- **README.md**: Documentation chính (architecture, usage, troubleshooting)
- **server.js**: MCP server implementation
- **test.js**: Test script
- **package.json**: Dependencies
