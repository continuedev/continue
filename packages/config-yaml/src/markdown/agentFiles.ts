import * as YAML from "yaml";
import z from "zod";
import { parseMarkdownRule } from "./markdownToRule.js";

/* 
    Experimental/internal config format for agents
*/
const agentFileFrontmatterSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  description: z.string().optional(),
  model: z.string().optional(),
  tools: z.string().optional(), // TODO also accept yaml array
  rules: z.string().optional(), // TODO also accept yaml array
});
export type AgentFileFrontmatter = z.infer<typeof agentFileFrontmatterSchema>;

const agentFileSchema = agentFileFrontmatterSchema.extend({
  prompt: z.string(),
});
export type AgentFile = z.infer<typeof agentFileSchema>;

/**
 * Parsed agent tool reference
 */
export interface AgentToolReference {
  /** MCP server slug (owner/package) or URL (https://...) if this is an MCP tool */
  mcpServer?: string;
  /** Specific tool name - either MCP tool name or built-in tool name */
  toolName?: string;
}

/**
 * Parsed agent tools configuration
 */
export interface ParsedAgentTools {
  /** All tool references */
  tools: AgentToolReference[];
  /** Unique MCP server slugs that need to be added to config */
  mcpServers: string[];
  /** Whether all built-in tools are allowed */
  allBuiltIn: boolean;
}

/**
 * Parses and validates an agent file from markdown content
 * Agent files must have frontmatter with at least a name
 */
export function parseAgentFile(content: string): AgentFile {
  const { frontmatter, markdown } = parseMarkdownRule(content);

  if (!frontmatter.name) {
    throw new Error(
      "Agent file must contain YAML frontmatter with a 'name' field",
    );
  }

  const validationResult = agentFileFrontmatterSchema.safeParse(frontmatter);

  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid agent file frontmatter: ${errorDetails}`);
  }

  return {
    ...validationResult.data,
    prompt: markdown,
  };
}

/**
 * Serializes an Agent file back to markdown with YAML frontmatter
 */
export function serializeAgentFile(agentFile: AgentFile): string {
  const { prompt, ...frontmatter } = agentFile;

  // Filter out undefined values from frontmatter
  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  );

  const yamlFrontmatter = YAML.stringify(cleanFrontmatter).trim();

  return `---\n${yamlFrontmatter}\n---\n${prompt}`;
}

/**
 * Parse agent tools string into structured format
 *
 * Supports formats:
 * - owner/package - all tools from MCP server
 * - owner/package:tool_name - specific tool from MCP server
 * - https://mcp.url.com or http://mcp.url.com - all tools from URL-based MCP server
 * - https://mcp.url.com:tool_name - specific tool from URL-based MCP server
 * - ToolName or tool_name - built-in tool
 * - built_in - all built-in tools
 *
 * @param toolsString Comma-separated tools string
 * @returns Parsed tools configuration
 */
export function parseAgentFileTools(toolsString?: string): ParsedAgentTools {
  if (!toolsString?.trim()) {
    return { tools: [], mcpServers: [], allBuiltIn: false };
  }

  const tools: AgentToolReference[] = [];
  const mcpServerSet = new Set<string>();
  let allBuiltIn = false;

  const toolRefs = toolsString
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  for (const toolRef of toolRefs) {
    if (toolRef === "built_in") {
      // Special keyword for all built-in tools
      allBuiltIn = true;
    } else if (
      toolRef.startsWith("http://") ||
      toolRef.startsWith("https://")
    ) {
      // URL-based MCP tool reference: "https://mcp.url.com" or "https://mcp.url.com:tool_name"
      const protocolEndIndex = toolRef.indexOf("://") + 3;
      const lastColonIndex = toolRef.lastIndexOf(":");

      // Check if there's a colon after the protocol
      if (lastColonIndex > protocolEndIndex) {
        const afterLastColon = toolRef.substring(lastColonIndex + 1);

        // Check if it's a port number (only digits), empty string, or a tool name
        if (/^\d+(?:$|[/?#])/.test(afterLastColon)) {
          // It's a port number, treat the whole thing as the server
          const mcpServer = toolRef;
          tools.push({ mcpServer });
          mcpServerSet.add(mcpServer);
        } else if (
          afterLastColon === "" ||
          /^[a-zA-Z0-9_-]+$/.test(afterLastColon)
        ) {
          // It's a tool name (or empty string)
          // Reject references with whitespace to prevent silent misconfigurations
          if (/\s/.test(toolRef)) {
            throw new Error(
              `Invalid MCP tool reference "${toolRef}": colon-separated tool references cannot contain whitespace. ` +
                `Use format "https://server:tool_name" without spaces.`,
            );
          }

          const mcpServer = toolRef.substring(0, lastColonIndex);
          const toolName = afterLastColon;

          tools.push({ mcpServer, toolName });
          mcpServerSet.add(mcpServer);
        } else {
          throw new Error(
            `Invalid URL-based MCP tool reference "${toolRef}": the part after the last colon must be either a port number or a valid tool name (alphanumeric, underscores, hyphens).`,
          );
        }
      } else {
        // No colon after the protocol, treat the whole thing as the server
        const mcpServer = toolRef;
        tools.push({ mcpServer });
        mcpServerSet.add(mcpServer);
      }
    } else if (toolRef.includes("/")) {
      // MCP tool reference: "owner/package" or "owner/package:tool_name"
      const colonIndex = toolRef.indexOf(":");

      if (colonIndex > 0) {
        // Specific tool: "owner/package:tool_name"
        // Reject references with whitespace to prevent silent misconfigurations
        if (/\s/.test(toolRef)) {
          throw new Error(
            `Invalid MCP tool reference "${toolRef}": colon-separated tool references cannot contain whitespace. ` +
              `Use format "owner/slug:tool_name" without spaces.`,
          );
        }

        const mcpServer = toolRef.substring(0, colonIndex);
        const toolName = toolRef.substring(colonIndex + 1);

        tools.push({ mcpServer, toolName });
        mcpServerSet.add(mcpServer);
      } else {
        // All tools from server: "owner/package"
        const mcpServer = toolRef;

        tools.push({ mcpServer });
        mcpServerSet.add(mcpServer);
      }
    } else {
      // Built-in tool
      tools.push({ toolName: toolRef });
    }
  }

  return {
    tools,
    mcpServers: Array.from(mcpServerSet),
    allBuiltIn,
  };
}

export function parseAgentFileRules(rules: string) {
  return rules
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}
