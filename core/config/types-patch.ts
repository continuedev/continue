import { ExperimentalMCPOptions } from './mcp-types';

/**
 * Updates to fix the experimental configuration interfaces
 */
export interface ExperimentalConfig {
  contextMenuPrompts?: ContextMenuConfig;
  modelRoles?: ExperimentalModelRoles;
  defaultContext?: DefaultContextProvider[];
  promptPath?: string;
  quickActions?: QuickActionConfig[];
  readResponseTTS?: boolean;
  useChromiumForDocsCrawling?: boolean;
  useTools?: boolean;
  
  /**
   * Model Context Protocol (MCP) server configurations
   */
  modelContextProtocolServers?: ExperimentalMCPOptions[];
}

// Re-export for use elsewhere
export type { ExperimentalMCPOptions };
