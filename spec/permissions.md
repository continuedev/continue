# Permissions

```bash
cn --allow Read --ask Write --exclude Bash

cn --no-tools --allow Read

cn --only Read

cn --mcp anthropic/filesystem --no-tools --allow anthropic/filesystem/read_file
```

```yaml
mcpServers:
  - name: GitHub MCP
    type: streamable-http
    url: https://api.github.com/mcp

permissions:
  - tool: Read
    permission: allow
  - tool: Write
    permission: ask
  - tool: Bash
    permission: exclude

permissions:
  - Read(*)
  - ~Write(**/*.ts)
  - !Bash(*)

allow:
  - Read(*)

ask:
  - Write(**/*.py)

exclude:
  - Write
```
