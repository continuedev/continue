import { ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { MCPAppResourceContent, MCPToolUIMetadata } from "../..";
import { MCPManagerSingleton } from "./MCPManagerSingleton";

/**
 * Fetches an MCP App UI resource from an MCP server
 * @param mcpServerId The ID of the MCP server
 * @param resourceUri The URI of the UI resource (typically starts with ui://)
 * @returns The HTML content and metadata for the MCP App
 */
export async function fetchMCPAppResource(
  mcpServerId: string,
  resourceUri: string,
): Promise<MCPAppResourceContent | null> {
  try {
    const connection =
      MCPManagerSingleton.getInstance().getConnection(mcpServerId);

    if (!connection) {
      console.error(`MCP connection not found for server: ${mcpServerId}`);
      return null;
    }

    const response = await connection.client.readResource(
      { uri: resourceUri },
      ReadResourceResultSchema,
      { timeout: connection.options.timeout },
    );

    if (
      !response.contents ||
      !Array.isArray(response.contents) ||
      response.contents.length === 0
    ) {
      console.error("No content returned from MCP resource");
      return null;
    }

    const content = response.contents[0];

    // Extract the resource content
    const resourceContent: MCPAppResourceContent = {
      uri: content.uri,
      mimeType: content.mimeType || "text/html",
      text: (content as any).text,
      blob: (content as any).blob,
      _meta: (content as any)._meta,
    };

    return resourceContent;
  } catch (error) {
    console.error("Error fetching MCP App resource:", error);
    return null;
  }
}

/**
 * Extracts the MCP server ID from a tool URI
 * @param toolUri The tool URI (e.g., mcp://server-id/tool-name)
 * @returns The MCP server ID or null if not an MCP tool
 */
export function extractMCPServerIdFromToolUri(
  toolUri: string | undefined,
): string | null {
  if (!toolUri || !toolUri.startsWith("mcp://")) {
    return null;
  }

  try {
    const url = new URL(toolUri);
    return decodeURIComponent(url.hostname);
  } catch {
    return null;
  }
}

/**
 * Checks if a tool has MCP App UI metadata
 * @param tool The tool to check
 * @returns True if the tool has MCP App UI metadata
 */
export function hasMCPAppUI(tool: { mcpAppUI?: MCPToolUIMetadata }): boolean {
  return !!tool.mcpAppUI?.resourceUri;
}
