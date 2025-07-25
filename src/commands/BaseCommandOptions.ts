/**
 * Base interface for command options that are shared across multiple commands
 */
export interface BaseCommandOptions {
  /** Path to configuration file */
  config?: string;
  /** Array of rule specifications (can be file paths, hub slugs, or string content) */
  rule?: string[];
  /** Array of tools to allow (overrides default policies) */
  allow?: string[];
  /** Array of tools to ask permission for (overrides default policies) */
  ask?: string[];
  /** Array of tools to exclude from use (overrides default policies) */
  exclude?: string[];
}

/**
 * Extended base options that include verbose and tool control flags
 */
export interface ExtendedCommandOptions extends BaseCommandOptions {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Only allow readonly tools */
  readonly?: boolean;
  /** Disable all tools */
  noTools?: boolean;
}