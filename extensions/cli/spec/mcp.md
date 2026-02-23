# Continue CLI Model Context Protocol (MCP) integration

## Intro

Model Context Protocol is a protocol for giving models access to resources and tools. MCP servers can run locally (stdio) or be remote (http/streamable/etc). See https://modelcontextprotocol.io/specification. The Continue CLI uses MCP to extend model's capabilities with MCP prompts and tools. MCP server configurations are stored in the `mcpServers` field of an assistant/config.yaml configuration.

## Secret Resolution

MCP server configurations often require secrets (API keys, tokens, etc.) referenced using template variables like `${{ secrets.API_KEY }}`. The CLI resolves these secrets in the following order:

1. **Organization/Package Secrets**: First attempts to resolve secrets through the Continue API for organization or package-level secrets
2. **Local Environment Variables**: Falls back to local environment variables if:
   - The API secret exists but isn't accessible locally (e.g., in devboxes or restricted environments)
   - The secret isn't found in organization/package secrets

Local environment variables are checked in this priority order:

- `process.env` (runtime environment variables)
- `~/.continue/.env`
- `<workspace>/.continue/.env`
- `<workspace>/.env`

This fallback mechanism ensures MCP servers can start successfully in environments where organization secrets aren't accessible, such as development containers or CI/CD pipelines, by allowing environment variables to provide the required credentials.

## MCP Service

The CLI has an MCP Service should manage connections to MCP servers and provide state to the terminal app regarding MCP server connections.
Service initialization for MCP servers can take especially long, so it should not block service initialization. Instead, initialization should kick off server connections and then resolve.
All configured server connections can be initialized simultaneously using Promise.all
Each server configuration should have its own connection and state separated, but the service should also have an easy way to retrieve all tools and prompts from all servers to pass to the model.
Servers should have a status "idle", "connecting", "connected", or "error". Only "connected" servers contribute prompts and tools.
If a server successfully connects but there is an error retrieving prompts or tools, it should have an array of warning messages that can be accessed in the terminal app.
When the process exits, all servers should be shut down and disconnected.
Only MCP servers for the CURRENT config should be loaded

- Logs from MCP servers should be routed through the winston logger, not the standard console.log (since this is a terminal app)

## MCP slash command

Users can manage MCP connections using the /mcp slash command.
/mcp shows a menu with the following options

- "No servers" if there are no servers
- Restart all servers
- Stop all servers
- View servers
- Back (esc also goes back)

View servers should open a submenu that has each server name with its status icon

- red if error, yellow if warnings, green if connected, gray if idle
- "No Servers" if there are none
- Back (esc also goes back)

Finally, selecting a server opens a sub-submenu that keeps the name/icon as header and lists

- Back (esc also goes back)
- Restart server
- Stop server
- warnings the server currently has
- prompts the server contributes
- tools the server contributes
