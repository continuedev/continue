import type { UIActionResult } from "@mcp-ui/client";
import { UIResourceRenderer } from "@mcp-ui/client";

interface MCPAppIframeProps {
  htmlContent: string;
  toolCallId: string;
  permissions?: string[];
  csp?: string[];
  toolResult?: any;
  resourceUri?: string;
}

/**
 * Component for rendering MCP App UIs in a sandboxed iframe
 * Uses @mcp-ui/client for standard MCP Apps protocol handling
 * Based on https://modelcontextprotocol.io/docs/extensions/apps
 */
export function MCPAppIframe({
  htmlContent,
  toolCallId,
  toolResult,
  resourceUri = `ui://${toolCallId}`,
}: MCPAppIframeProps) {
  const resource = {
    uri: resourceUri,
    mimeType: "text/html" as const,
    text: htmlContent,
  };

  const handleUIAction = async (result: UIActionResult): Promise<unknown> => {
    switch (result.type) {
      case "tool":
        onMessage?.({
          type: "mcpApp/callTool",
          toolCallId,
          payload: result.payload,
          messageId: result.messageId,
        });
        break;
      case "link":
        onMessage?.({
          type: "mcpApp/openUrl",
          payload: result.payload,
        });
        break;
      case "notify":
        console.log(`[MCP App ${toolCallId}]`, result.payload.message);
        break;
      case "intent":
        onMessage?.({
          type: "mcpApp/intent",
          toolCallId,
          payload: result.payload,
          messageId: result.messageId,
        });
        break;
      case "prompt":
        onMessage?.({
          type: "mcpApp/prompt",
          toolCallId,
          payload: result.payload,
          messageId: result.messageId,
        });
        break;
    }
    return { status: "handled" };
  };

  return (
    <div
      className="mcp-app-container"
      style={{
        width: "100%",
        height: "500px",
        border: "1px solid #444",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <UIResourceRenderer
        resource={resource}
        onUIAction={handleUIAction}
        htmlProps={{
          iframeRenderData: toolResult ? { toolResult } : undefined,
          style: {
            width: "100%",
            height: "100%",
            border: "none",
          },
        }}
      />
    </div>
  );
}
