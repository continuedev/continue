/**
 * Base interface for command options that are shared across multiple commands
 * Uses command-line flag names for direct compatibility
 */
export interface BaseCommandOptions {
  /** Path to configuration file (--config) */
  config?: string;
  /** Organization slug to use for this session (--org) */
  org?: string;
  /** Array of rule specifications (--rule) */
  rule?: string[];
  /** Array of MCP server slugs from the hub (--mcp) */
  mcp?: string[];
  /** Array of model slugs from the hub (--model) */
  model?: string[];
  /** Array of prompt slugs from the hub (--prompt) */
  prompt?: string[];
  /** Array of tools to allow (--allow) */
  allow?: string[];
  /** Array of tools to ask permission for (--ask) */
  ask?: string[];
  /** Array of tools to exclude from use (--exclude) */
  exclude?: string[];
  /** Agent file slug from the hub (--agent) */
  agent?: string;
  /** Enable beta UploadArtifact tool */
  betaUploadArtifactTool?: boolean;
  /** Enable beta Subagent tool */
  betaSubagentTool?: boolean;
}

/**
 * Extended base options that include verbose and tool control flags
 */
export interface ExtendedCommandOptions extends BaseCommandOptions {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Start in plan mode (backward compatibility) */
  readonly?: boolean;
  /** Start in auto mode (all tools allowed) */
  auto?: boolean;
}
