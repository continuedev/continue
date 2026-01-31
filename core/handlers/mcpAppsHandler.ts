import { MCPAppResourceContent } from "..";
import { fetchMCPAppResource } from "../context/mcp/MCPAppsResource";
import { MCPManagerSingleton } from "../context/mcp/MCPManagerSingleton";

/**
 * Handler for MCP Apps protocol messages
 */
export class MCPAppsHandler {
  /**
   * Fetch the HTML content for an MCP App UI resource
   */
  static async fetchUI(
    toolCallId: string,
    mcpServerId: string,
    resourceUri: string,
  ): Promise<{
    htmlContent?: string;
    permissions?: string[];
    csp?: string[];
    error?: string;
  }> {
    try {
      const resourceContent = await fetchMCPAppResource(
        mcpServerId,
        resourceUri,
      );

      if (!resourceContent) {
        return {
          error: "Failed to fetch MCP App resource",
        };
      }

      return {
        htmlContent: resourceContent.text,
        permissions: resourceContent._meta?.ui?.permissions,
        csp: resourceContent._meta?.ui?.csp,
      };
    } catch (error) {
      console.error("Error fetching MCP App UI:", error);
      return {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Call an MCP tool from within an MCP App
   */
  static async callTool(
    mcpServerId: string,
    name: string,
    args: Record<string, any>,
  ): Promise<{
    content: Array<{
      type: string;
      text?: string;
      [key: string]: any;
    }>;
  }> {
    try {
      const connection =
        MCPManagerSingleton.getInstance().getConnection(mcpServerId);

      if (!connection) {
        throw new Error(`MCP connection not found: ${mcpServerId}`);
      }

      const result = await connection.client.callTool(
        { name, arguments: args },
        undefined as any,
        { timeout: connection.options.timeout },
      );

      return {
        content: result.content as any[],
      };
    } catch (error) {
      console.error("Error calling MCP tool from app:", error);
      throw error;
    }
  }
}
