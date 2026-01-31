/**
 * Protocol messages for MCP Apps communication
 * Based on https://modelcontextprotocol.io/docs/extensions/apps
 */

export interface MCPAppProtocol {
  // Host -> App: Fetch MCP App HTML for a tool call
  "mcpApp/fetchUI": [
    {
      toolCallId: string;
      mcpServerId: string;
      resourceUri: string;
    },
    {
      htmlContent?: string;
      permissions?: string[];
      csp?: string[];
      error?: string;
    },
  ];

  // App -> Host: Forward a postMessage from the MCP App iframe
  "mcpApp/postMessage": [
    {
      toolCallId: string;
      message: any;
    },
    void,
  ];

  // Host -> App: Send a message to the MCP App iframe
  "mcpApp/sendMessage": [
    {
      toolCallId: string;
      message: any;
    },
    void,
  ];

  // App (iframe) -> Host: Call an MCP tool from within the app
  "mcpApp/callTool": [
    {
      name: string;
      arguments: Record<string, any>;
    },
    {
      content: Array<{
        type: string;
        text?: string;
        [key: string]: any;
      }>;
    },
  ];

  // Host -> App (iframe): Send tool call result to the app
  "mcpApp/toolResult": [
    {
      toolCallId: string;
      result: any;
    },
    void,
  ];

  // App (iframe) -> Host: Initialize the app
  "mcpApp/initialize": [
    {
      name: string;
      version: string;
    },
    {
      capabilities?: string[];
    },
  ];

  // App (iframe) -> Host: Log a message from the app
  "mcpApp/log": [
    {
      level: "info" | "warn" | "error" | "debug";
      message: string;
    },
    void,
  ];

  // App (iframe) -> Host: Open a URL
  "mcpApp/openUrl": [
    {
      url: string;
    },
    void,
  ];
}
