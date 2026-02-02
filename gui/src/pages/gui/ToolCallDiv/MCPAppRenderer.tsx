import {
  McpUiResourceCsp,
  McpUiResourcePermissions,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps";

import {
  AppBridge,
  buildAllowAttribute,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { ToolCallState } from "core";
import { getToolNameFromMCPServer } from "core/tools/mcpToolName";
import { generateOpenAIToolCallId } from "core/tools/systemMessageTools/systemToolUtils";
import { renderContextItems } from "core/util/messageContent";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { streamResponseThunk } from "../../../redux/thunks/streamResponse";

/**
 * Build a CSP meta tag content string from McpUiResourceCsp configuration.
 * This allows the iframe to make network requests to the specified domains.
 */
function buildCspMetaContent(csp: McpUiResourceCsp | undefined): string {
  const resourceDomains = csp?.resourceDomains ?? [];
  const connectDomains = csp?.connectDomains ?? [];

  // Combine all external domains for resource loading
  const allDomains = [...new Set([...resourceDomains, ...connectDomains])];

  const defaultSrc = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "blob:",
    "data:",
    ...allDomains,
  ].join(" ");
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "blob:",
    ...allDomains,
  ].join(" ");
  const styleSrc = ["'self'", "'unsafe-inline'", ...allDomains].join(" ");
  const imgSrc = ["'self'", "blob:", "data:", ...allDomains].join(" ");
  const fontSrc = ["'self'", "data:", ...allDomains].join(" ");
  const connectSrc = ["'self'", "blob:", "data:", ...allDomains].join(" ");
  const mediaSrc = ["'self'", "blob:", "data:", ...allDomains].join(" ");
  const frameSrc = ["'self'", "blob:", "data:", ...allDomains].join(" ");
  const workerSrc = ["'self'", "blob:", ...allDomains].join(" ");

  const directives = [
    `default-src ${defaultSrc}`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src ${imgSrc}`,
    `font-src ${fontSrc}`,
    `connect-src ${connectSrc}`,
    `media-src ${mediaSrc}`,
    `frame-src ${frameSrc}`,
    `worker-src ${workerSrc}`,
  ];

  return directives.join("; ");
}

/**
 * MCP App renderer using AppBridge with srcdoc iframe.
 * VS Code webviews have restrictive CSP that blocks iframe src URLs,
 * so we embed HTML directly via srcdoc and use AppBridge for the protocol.
 *
 * Handles MCP UI resource metadata:
 * - `permissions`: Sets iframe `allow` attribute (camera, microphone, geolocation, clipboard-write)
 * - `csp`: Passes CSP config to the app via sendSandboxResourceReady
 * - `prefersBorder`: Controls iframe border styling
 *
 * Note on permissions: We properly set the iframe's `allow` attribute based on
 * the MCP resource metadata. However, VS Code's webview runs in a sandboxed
 * Electron context with its own Permissions-Policy that doesn't allow delegating
 * sensitive permissions (microphone, camera, etc.) to nested iframes. This is a
 * VS Code/Electron security limitation that cannot be overridden from extensions.
 */
export function McpAppRenderer({
  toolCallState,
}: {
  toolCallState: ToolCallState;
}) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const appBridgeRef = useRef<AppBridge | null>(null);
  const [iframeHeight, setIframeHeight] = useState(300);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const html = toolCallState.mcpUiState?.content.text;
  const uiMeta = toolCallState.mcpUiState?.content._meta?.ui;
  const toolInput = toolCallState.parsedArgs;
  const toolResult = toolCallState.output;

  // Extract metadata from the MCP UI resource
  const csp: McpUiResourceCsp | undefined = uiMeta?.csp;
  const permissions: McpUiResourcePermissions | undefined = uiMeta?.permissions;
  const prefersBorder = uiMeta?.prefersBorder ?? true;

  const [permissionWarningDismissed, setPermissionWarningDismissed] =
    useState(false);

  const restrictedPermissions = useMemo(() => {
    const restricted: string[] = [];
    if (permissions?.microphone) restricted.push("microphone");
    if (permissions?.camera) restricted.push("camera");
    if (permissions?.geolocation) restricted.push("geolocation");
    return restricted;
  }, [permissions]);

  const hasRestrictedPermissions = restrictedPermissions.length > 0;

  const sandboxAttribute = useMemo(() => {
    const basePermissions = ["allow-scripts", "allow-same-origin"];
    return basePermissions.join(" ");
  }, [permissions]);

  const allowAttribute = useMemo(() => {
    const attr = buildAllowAttribute(permissions);
    return attr || undefined;
  }, [permissions]);

  useEffect(() => {
    const bridge = new AppBridge(
      null,
      { name: "Continue", version: "1.0.0" },
      {
        openLinks: {},
        logging: {},
        message: { text: {} },
        updateModelContext: { text: {}, structuredContent: {} },
        serverTools: {},
      },
    );

    bridge.onsizechange = (params: { width?: number; height?: number }) => {
      if (params.height !== undefined) {
        setIframeHeight(Math.min(Math.max(params.height + 20, 100), 800));
      }
    };

    bridge.oninitialized = () => {
      setIsInitialized(true);
    };

    bridge.onopenlink = async (params: { url: string }) => {
      if (params.url) {
        ideMessenger.post("openUrl", params.url);
      }
      return {};
    };

    bridge.onmessage = async (params: { role: string; content: unknown[] }) => {
      const text = params.content
        .filter((item: any) => item.type === "text" && item.text)
        .map((item: any) => item.text)
        .join("\n");

      if (!text) {
        console.warn(
          "[McpAppRenderer] onMessage received with no text content",
        );
        return {};
      }

      const editorState = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text }],
          },
        ],
      };

      void dispatch(
        streamResponseThunk({
          editorState,
          modifiers: { noContext: true, useCodebase: false },
        }),
      );

      return {};
    };

    bridge.oncalltool = async (params: any) => {
      const output = await ideMessenger.request("tools/call", {
        toolCall: {
          function: {
            name: getToolNameFromMCPServer(
              toolCallState.tool?.group ?? "",
              params.name,
            ),
            arguments: JSON.stringify(params.arguments),
          },
          id: generateOpenAIToolCallId(),
          type: "function",
        },
      });
      if (output.status === "error") {
        throw new Error(`Failed to call tool from MCP UI: ${output.error}`);
      }
      return {
        content: output.content.contextItems.map((ci) => ({
          type: "text",
          text: renderContextItems([ci]),
        })),
        isError: true,
      };
    };

    bridge.onlistresources = async () => {
      return { resources: [] };
    };

    bridge.onreadresource = async () => {
      throw new Error("Resource reads not supported in this context");
    };

    bridge.onloggingmessage = (params: {
      level: string;
      logger?: string;
      data: unknown;
    }) => {
      const logFn =
        params.level === "error" || params.level === "critical"
          ? console.error
          : params.level === "warning"
            ? console.warn
            : console.log;
      logFn(
        `[MCP App${params.logger ? ` - ${params.logger}` : ""}]`,
        params.data,
      );
    };

    bridge.onupdatemodelcontext = async () => {
      return {};
    };

    appBridgeRef.current = bridge;

    return () => {
      appBridgeRef.current = null;
    };
  }, [ideMessenger, dispatch]);

  // Connect bridge to iframe when it loads
  const handleIframeLoad = useCallback(async () => {
    const iframe = iframeRef.current;
    const bridge = appBridgeRef.current;
    if (!iframe?.contentWindow || !bridge) return;

    try {
      const transport = new PostMessageTransport(
        iframe.contentWindow,
        iframe.contentWindow,
      );

      await bridge.connect(transport);

      if (html) {
        await bridge.sendSandboxResourceReady({
          html,
          csp,
          permissions,
        });
      }
    } catch (err) {
      console.error("[Continue] Failed to connect bridge to MCP App UI:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [html, csp, permissions]);

  useEffect(() => {
    const bridge = appBridgeRef.current;
    if (!bridge || !isInitialized || !toolInput) return;
    bridge.sendToolInput({ arguments: toolInput });
  }, [isInitialized, toolInput]);

  useEffect(() => {
    const bridge = appBridgeRef.current;
    if (!bridge || !isInitialized || !toolResult) return;
    bridge.sendToolResult({
      content: toolResult.map((o) => ({
        type: "text" as const,
        text: o.content,
      })),
    });
  }, [isInitialized, toolResult]);

  if (!toolCallState.mcpUiState || !html) {
    return null;
  }

  if (error) {
    return (
      <div className="rounded border border-red-500 bg-red-500/10 p-3 text-sm">
        <p className="font-medium text-red-500">MCP UI Error</p>
        <p className="text-red-400">{error.message}</p>
      </div>
    );
  }

  const cspMetaContent = buildCspMetaContent(csp);

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${cspMetaContent}">
  <style>
    html, body {
      margin: 0;
      padding: 0;
    }
    /* Minimal scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(128, 128, 128, 0.4);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(128, 128, 128, 0.6);
    }
    ::-webkit-scrollbar-corner {
      background: transparent;
    }
    /* Firefox */
    html {
      scrollbar-width: thin;
      scrollbar-color: rgba(128, 128, 128, 0.4) transparent;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox={sandboxAttribute}
        allow={allowAttribute}
        onLoad={handleIframeLoad}
        className={`bg-input w-full ${
          prefersBorder ? "border-input rounded border" : "border-none"
        }`}
        style={{ height: iframeHeight }}
        title={`MCP App - ${toolCallState.toolCall.function.name}`}
      />

      {hasRestrictedPermissions && !permissionWarningDismissed && (
        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85 p-5 ${
            prefersBorder ? "rounded" : ""
          }`}
        >
          <div className="max-w-[25rem] text-center">
            <div className="mb-3 text-2xl">⚠️</div>
            <p className="text-foreground mb-2 text-sm font-medium">
              Limited Functionality
            </p>
            <p className="text-description mb-4 text-xs leading-relaxed">
              This app requires{" "}
              <strong className="text-foreground">
                {restrictedPermissions.join(", ")}
              </strong>{" "}
              access, which is not currently supported. Some features may not
              work.
            </p>
            <button
              onClick={() => setPermissionWarningDismissed(true)}
              className="bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer rounded border-none px-4 py-2 text-xs font-medium"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
