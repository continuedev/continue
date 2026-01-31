# MCP Apps Support Implementation

This document outlines the implementation of MCP Apps support in Continue, following the MCP Apps specification at https://modelcontextprotocol.io/docs/extensions/apps

## Overview

MCP Apps allow MCP servers to return interactive HTML interfaces (data visualizations, forms, dashboards) that render directly in the chat. This provides a richer user experience than plain text responses.

## Components Implemented

### 1. Type Definitions (`core/index.d.ts`)

Added the following types to support MCP Apps:

- `MCPToolUIMetadata`: Metadata for MCP App UI resources

  - `resourceUri`: URI of the UI resource (typically `ui://`)
  - `permissions`: Additional iframe permissions
  - `csp`: Content Security Policy origins

- `MCPAppResourceContent`: Content structure for UI resources

  - `uri`, `mimeType`, `text`, `blob`
  - `_meta.ui`: UI-specific metadata

- Updated `MCPTool` interface to include `_meta.ui` field
- Updated `Tool` interface to include `mcpAppUI` metadata
- Updated `ToolCallState` to include `mcpAppUI` data for rendering

### 2. Resource Fetching (`core/context/mcp/MCPAppsResource.ts`)

Utility functions for working with MCP App resources:

- `fetchMCPAppResource()`: Fetches UI resources from MCP servers
- `extractMCPServerIdFromToolUri()`: Extracts server ID from tool URIs
- `hasMCPAppUI()`: Checks if a tool has MCP App UI

### 3. Protocol Messages (`core/protocol/mcpApps.ts`, `core/protocol/core.ts`)

Added protocol messages for MCP App communication:

- `mcpApp/fetchUI`: Fetch HTML content for an MCP App
- `mcpApp/postMessage`: Forward postMessage from iframe to host
- `mcpApp/sendMessage`: Send message from host to iframe
- `mcpApp/callTool`: Call MCP tool from within the app
- `mcpApp/toolResult`: Send tool result to the app
- `mcpApp/initialize`: Initialize the app
- `mcpApp/log`: Log messages from the app
- `mcpApp/openUrl`: Open URLs from the app

### 4. Configuration Loading (`core/config/profile/doLoadConfig.ts`)

Updated tool loading to detect and include MCP App UI metadata from MCP servers. When loading tools, the code now checks for `_meta.ui` in the tool definition and includes it in the tool object.

### 5. GUI Components

#### MCPAppIframe Component (`gui/src/components/MCPApp/MCPAppIframe.tsx`)

React component for rendering MCP Apps in a sandboxed iframe:

- Renders HTML content in a sandboxed iframe with appropriate permissions
- Implements bidirectional postMessage communication
- Handles MCP protocol messages (ui/initialize, tools/call, ui/openUrl, etc.)
- Sends tool results to the app when available
- Applies Content Security Policy

#### Tool Call UI Integration (`gui/src/pages/gui/ToolCallDiv/index.tsx`)

Updated the tool call display to detect and render MCP App UIs:

- Checks if a tool call state has `mcpAppUI.htmlContent`
- Renders the `MCPAppIframe` component instead of regular output
- Passes tool results to the iframe

### 6. Handler Functions (`core/handlers/mcpAppsHandler.ts`)

Handler functions for MCP Apps protocol messages:

- `MCPAppsHandler.fetchUI()`: Fetches UI resource HTML content
- `MCPAppsHandler.callTool()`: Proxies tool calls from apps to MCP servers

## Security Model

MCP Apps run in sandboxed iframes with the following security features:

1. **Iframe Sandbox**: Prevents access to parent DOM, cookies, and local storage
2. **Content Security Policy**: Controls which external origins can be loaded
3. **postMessage Communication**: All communication uses the secure postMessage API
4. **Permission Control**: Specific capabilities (microphone, camera, etc.) must be explicitly requested

## Usage Flow

1. **Tool Registration**: MCP server registers a tool with `_meta.ui.resourceUri`
2. **Tool Call**: LLM decides to call the tool
3. **UI Fetch**: Host fetches the UI resource from the MCP server
4. **Rendering**: Host renders the HTML in a sandboxed iframe
5. **Interaction**: User interacts with the app, which can:
   - Call additional MCP tools
   - Display results in the interface
   - Open URLs
   - Log messages

## Files Modified/Created

### Created:

- `core/context/mcp/MCPAppsResource.ts`
- `core/protocol/mcpApps.ts`
- `core/handlers/mcpAppsHandler.ts`
- `gui/src/components/MCPApp/MCPAppIframe.tsx`
- `IMPLEMENTATION_NOTES.md`

### Modified:

- `core/index.d.ts`
- `core/protocol/coreWebview.ts`
- `core/protocol/core.ts`
- `core/config/profile/doLoadConfig.ts`
- `gui/src/pages/gui/ToolCallDiv/index.tsx`

## TODO / Integration Points

The following handlers need to be added to `core/core.ts` in the `registerMessageHandlers` method:

```typescript
// MCP Apps handlers (add after mcp/removeAuthentication handler around line 565)
on("mcpApp/fetchUI", async (msg) => {
  const { MCPAppsHandler } = await import("./handlers/mcpAppsHandler");
  return MCPAppsHandler.fetchUI(
    msg.data.toolCallId,
    msg.data.mcpServerId,
    msg.data.resourceUri,
  );
});

on("mcpApp/callTool", async (msg) => {
  const { MCPAppsHandler } = await import("./handlers/mcpAppsHandler");
  return MCPAppsHandler.callTool(
    msg.data.mcpServerId,
    msg.data.name,
    msg.data.arguments,
  );
});
```

Additionally, tool call handling may need to be updated to fetch MCP App UI resources when a tool with `mcpAppUI` metadata is called.

## Testing

To test MCP Apps support:

1. Set up an MCP server that returns tools with `_meta.ui.resourceUri`
2. Configure Continue to connect to the MCP server
3. Trigger a tool call that has MCP App UI
4. Verify that the iframe renders correctly
5. Test bidirectional communication (tool calls from app, results displayed in app)

## References

- [MCP Apps Documentation](https://modelcontextprotocol.io/docs/extensions/apps)
- [MCP Apps Examples](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples)
- [MCP Apps API Documentation](https://modelcontextprotocol.github.io/ext-apps/api/)
