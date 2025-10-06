import * as YAML from "yaml";
import z from "zod";
import { parseMarkdownRule } from "./markdownToRule.js";

/* 
    Experimental/internal config format for workflows
*/
const workflowFileFrontmatterSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  description: z.string().optional(),
  model: z.string().optional(),
  tools: z.string().optional(), // TODO also accept yaml array
  rules: z.string().optional(), // TODO also accept yaml array
});
export type WorkflowFileFrontmatter = z.infer<
  typeof workflowFileFrontmatterSchema
>;

const workflowFileSchema = workflowFileFrontmatterSchema.extend({
  prompt: z.string(),
});
export type WorkflowFile = z.infer<typeof workflowFileSchema>;

/**
 * Parsed workflow tool reference
 */
export interface WorkflowToolReference {
  /** MCP server slug (owner/package) if this is an MCP tool */
  mcpServer?: string;
  /** Specific tool name - either MCP tool name or built-in tool name */
  toolName?: string;
}

/**
 * Parsed workflow tools configuration
 */
export interface ParsedWorkflowTools {
  /** All tool references */
  tools: WorkflowToolReference[];
  /** Unique MCP server slugs that need to be added to config */
  mcpServers: string[];
  /** Whether all built-in tools are allowed */
  allBuiltIn: boolean;
}

/**
 * Parses and validates a workflow file from markdown content
 * Workflow files must have frontmatter with at least a name
 */
export function parseWorkflowFile(content: string): WorkflowFile {
  const { frontmatter, markdown } = parseMarkdownRule(content);

  if (!frontmatter.name) {
    throw new Error(
      "Workflow file must contain YAML frontmatter with a 'name' field",
    );
  }

  const validationResult = workflowFileFrontmatterSchema.safeParse(frontmatter);

  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid workflow file frontmatter: ${errorDetails}`);
  }

  return {
    ...validationResult.data,
    prompt: markdown,
  };
}

/**
 * Serializes a Workflow file back to markdown with YAML frontmatter
 */
export function serializeWorkflowFile(workflowFile: WorkflowFile): string {
  const { prompt, ...frontmatter } = workflowFile;

  // Filter out undefined values from frontmatter
  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  );

  const yamlFrontmatter = YAML.stringify(cleanFrontmatter).trim();

  return `---\n${yamlFrontmatter}\n---\n${prompt}`;
}

/**
 * Parse workflow tools string into structured format
 *
 * Supports formats:
 * - owner/package - all tools from MCP server
 * - owner/package:tool_name - specific tool from MCP server
 * - ToolName or tool_name - built-in tool
 * - built_in - all built-in tools
 *
 * @param toolsString Comma-separated tools string
 * @returns Parsed tools configuration
 */
export function parseWorkflowTools(toolsString?: string): ParsedWorkflowTools {
  if (!toolsString?.trim()) {
    return { tools: [], mcpServers: [], allBuiltIn: false };
  }

  const tools: WorkflowToolReference[] = [];
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
