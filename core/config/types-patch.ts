import { ExperimentalMCPOptions } from './mcp-types';

/**
 * コンテキストメニュー設定
 */
export interface ContextMenuConfig {
  items?: any[];
  enabled?: boolean;
  // 他の必要なプロパティ
}

/**
 * 実験的モデルロール
 */
export interface ExperimentalModelRoles {
  inlineEdit?: string;
  applyCodeBlock?: string;
  // 他の必要なプロパティ
}

/**
 * デフォルトコンテキストプロバイダ
 */
export interface DefaultContextProvider {
  name: string;
  description?: string;
  enabled?: boolean;
  params?: Record<string, any>;
  // 他の必要なプロパティ
}

/**
 * クイックアクション設定
 */
export interface QuickActionConfig {
  actions?: any[];
  enabled?: boolean;
  // 他の必要なプロパティ
}

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
