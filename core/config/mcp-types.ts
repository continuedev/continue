/**
 * Model Context Protocol (MCP) configuration types
 */

/**
 * Experimental MCP Server configuration options
 */
export interface ExperimentalMCPOptions {
  /** Server identifier */
  id?: string;
  /** Display name for the server */
  name?: string;
  /** Server connection type ('yaml-file', 'stdio', 'websocket', etc.) */
  type?: string;
  /** File path for yaml-file type connections */
  path?: string;
  /** Transport configuration for the server */
  transport?: {
    /** Transport type ('stdio', 'websocket', 'sse') */
    type: string;
    /** Command to execute for stdio transport */
    command?: string;
    /** Command arguments for stdio transport */
    args?: string[];
    /** URL for websocket or SSE transports */
    url?: string;
  };
  /** Model context protocol configuration */
  modelContextProtocol?: {
    /** Available context providers */
    providers?: {
      /** Provider name */
      name: string;
      /** Provider description */
      description?: string;
      /** Whether the provider is enabled */
      enabled?: boolean;
    }[];
    /** Security settings */
    security?: {
      /** List of paths that are allowed to be accessed */
      allowedPaths?: string[];
    };
  };
  /** Other server-specific properties */
  [key: string]: any;
}
