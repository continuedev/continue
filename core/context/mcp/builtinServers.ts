import { InternalMcpOptions } from "../..";

/**
 * Built-in MCP servers that are available by default in Continue.
 * These servers are loaded automatically unless explicitly disabled by the user.
 */
export interface BuiltInMcpServerConfig {
  id: string;
  name: string;
  description?: string;
  type: "streamable-http" | "sse" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
  readonly?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
  enabledByDefault: boolean;
}

/**
 * Context7 MCP Server - Provides up-to-date documentation for libraries and frameworks
 * using semantic search and retrieval from Context7's documentation index.
 */
export const CONTEXT7_SERVER: BuiltInMcpServerConfig = {
  id: "builtin-context7",
  name: "Context7",
  description:
    "Search up-to-date documentation for libraries and frameworks. Should always be called to get latest information about Flexprice.",
  type: "streamable-http",
  url: "https://mcp.context7.com/mcp",
  readonly: true,
  apiKey: "ctx7sk-ad277c04-2ae2-4a09-b5f3-e85807f2d4de",
  enabledByDefault: true,
};

/**
 * All built-in MCP servers available in Continue.
 * Add new built-in servers to this array.
 */
export const BUILTIN_MCP_SERVERS: BuiltInMcpServerConfig[] = [CONTEXT7_SERVER];

/**
 * Convert a built-in server configuration to InternalMcpOptions format.
 */
export function convertBuiltInToInternalOptions(
  server: BuiltInMcpServerConfig,
): InternalMcpOptions {
  const base = {
    id: server.id,
    name: server.name,
    readonly: server.readonly,
    isBuiltIn: true,
  };

  if (server.type === "stdio" && server.command) {
    return {
      ...base,
      type: "stdio" as const,
      command: server.command,
      args: server.args,
      env: server.env,
    };
  } else if (server.url) {
    const options: InternalMcpOptions = {
      ...base,
      type: server.type as "streamable-http" | "sse",
      url: server.url,
    };

    // Add API key to request options if provided
    if (server.apiKey) {
      options.requestOptions = {
        headers: {
          Authorization: `Bearer ${server.apiKey}`,
        },
      };
    }

    return options;
  }

  throw new Error(`Invalid built-in server configuration: ${server.id}`);
}

/**
 * Get all built-in MCP servers that should be loaded based on user configuration.
 * @param disabledServerIds Array of built-in server IDs to disable
 * @param disableAll If true, all built-in servers are disabled
 * @returns Array of InternalMcpOptions for enabled built-in servers
 */
export function getBuiltInMcpServers(
  disabledServerIds: string[] = [],
  disableAll: boolean = false,
): InternalMcpOptions[] {
  if (disableAll) {
    return [];
  }

  return BUILTIN_MCP_SERVERS.filter(
    (server) =>
      server.enabledByDefault && !disabledServerIds.includes(server.id),
  ).map(convertBuiltInToInternalOptions);
}

/**
 * Check if a server ID is a built-in server.
 */
export function isBuiltInServerId(id: string): boolean {
  return BUILTIN_MCP_SERVERS.some((server) => server.id === id);
}

/**
 * Get a built-in server configuration by ID.
 */
export function getBuiltInServerById(
  id: string,
): BuiltInMcpServerConfig | undefined {
  return BUILTIN_MCP_SERVERS.find((server) => server.id === id);
}
