# Linear MCP Setup Guide

This guide shows how to set up Linear MCP (Model Context Protocol) integration to create tickets programmatically.

## Prerequisites

1. **Linear API Key**: You need a Linear API key from your Linear workspace
   - Go to Linear → Settings → API → Create API Key
   - Copy the key (starts with `lin_api_...`)

2. **Environment Setup**: Set the Linear API key as an environment variable:
   ```bash
   export LINEAR_API_KEY="your_linear_api_key_here"
   ```

## MCP Configuration

The Linear MCP server configuration has been added to `.continue/mcpServers/linear-mcp.yaml`:

```yaml
name: Linear MCP
description: Linear MCP server for creating and managing Linear issues

mcpServers:
  - name: "Linear"
    type: "stdio"
    command: "npx"
    args: ["@linear/mcp-server"]
    env:
      LINEAR_API_KEY: "${LINEAR_API_KEY}"
```

## Usage

### Option 1: Using the Node.js Script

Run the provided script to create a test ticket:

```bash
# Set your Linear API key first
export LINEAR_API_KEY="lin_api_your_key_here"

# Run the script
node create-linear-ticket.js
```

### Option 2: Using Continue CLI (when available)

Once the Continue CLI is properly built and the MCP server is connected, you can use MCP tools directly:

```bash
continue mcp call linear create_issue --title "create test ticket" --description "Test ticket created via MCP"
```

### Option 3: Direct API Call

The script includes a fallback to use Linear's GraphQL API directly if MCP is not available.

## Testing

To test the MCP setup:

1. Install the Linear MCP server:
   ```bash
   npm install -g @linear/mcp-server
   ```

2. Set your API key:
   ```bash
   export LINEAR_API_KEY="your_key_here"
   ```

3. Run the test script:
   ```bash
   node create-linear-ticket.js
   ```

## Expected Output

When successful, you should see:
```
✅ Linear ticket created successfully!
Title: create test ticket
ID: [ticket-id]
URL: https://linear.app/[workspace]/issue/[ticket-key]
```

## Troubleshooting

1. **API Key Issues**: Make sure your Linear API key is valid and has the necessary permissions
2. **MCP Server Issues**: If the MCP server fails, the script will fall back to direct API calls
3. **Network Issues**: Ensure you have internet connectivity to reach Linear's API

## Integration with Continue

This setup enables the Continue AI assistant to create Linear tickets using the MCP protocol, providing a standardized way to interact with Linear's issue tracking system.