import React, { useEffect, useRef, useState } from "react";

interface MCPAppIframeProps {
  htmlContent: string;
  toolCallId: string;
  permissions?: string[];
  csp?: string[];
  onMessage?: (message: any) => void;
  toolResult?: any;
}

/**
 * Component for rendering MCP App UIs in a sandboxed iframe
 * Based on https://modelcontextprotocol.io/docs/extensions/apps
 */
export function MCPAppIframe({
  htmlContent,
  toolCallId,
  permissions = [],
  csp = [],
  onMessage,
  toolResult,
}: MCPAppIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify the message is from our iframe
      if (
        !iframeRef.current ||
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }

      // Parse MCP protocol message
      if (event.data && typeof event.data === "object") {
        const { method, params, id } = event.data;

        if (method === "ui/initialize") {
          // App is ready
          setIsReady(true);

          // Send initialization response
          iframeRef.current?.contentWindow?.postMessage(
            {
              jsonrpc: "2.0",
              id,
              result: {
                capabilities: ["tools/call", "openUrl", "log"],
              },
            },
            "*",
          );

          // Send initial tool result if available
          if (toolResult) {
            sendToolResult(toolResult);
          }
        } else if (method === "tools/call" || method === "ui/callTool") {
          // Forward tool call to host
          if (onMessage) {
            onMessage({
              type: "mcpApp/callTool",
              toolCallId,
              payload: params,
              messageId: id,
            });
          }
        } else if (method === "ui/openUrl") {
          // Forward URL open request to host
          if (onMessage) {
            onMessage({
              type: "mcpApp/openUrl",
              payload: params,
            });
          }
        } else if (method === "ui/log") {
          // Forward log message to host
          console.log(`[MCP App ${toolCallId}]`, params);
        } else {
          // Forward other messages to host
          if (onMessage) {
            onMessage({
              type: "mcpApp/message",
              toolCallId,
              payload: event.data,
            });
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toolCallId, onMessage, toolResult]);

  // Function to send tool result to the iframe
  const sendToolResult = (result: any) => {
    if (isReady && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/toolResult",
          params: result,
        },
        "*",
      );
    }
  };

  // Send tool result when it becomes available
  useEffect(() => {
    if (toolResult && isReady) {
      sendToolResult(toolResult);
    }
  }, [toolResult, isReady]);

  // Create the iframe sandbox attributes
  const sandboxAttrs = [
    "allow-scripts",
    "allow-same-origin",
    "allow-forms",
    ...(permissions || []).map((p) => `allow-${p}`),
  ].join(" ");

  // Create a data URL with the HTML content and CSP meta tag
  const cspDirective = csp && csp.length > 0 ? csp.join(" ") : "'self'";
  const htmlWithCSP = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src ${cspDirective}">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlWithCSP)}`;

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
      <iframe
        ref={iframeRef}
        src={dataUrl}
        sandbox={sandboxAttrs}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
        title={`MCP App - ${toolCallId}`}
      />
    </div>
  );
}
