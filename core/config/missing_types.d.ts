// 不足している型定義を提供する

// コンテキストメニュー設定
declare interface ContextMenuConfig {
  items?: any[];
  enabled?: boolean;
  // 他の必要なプロパティ
}

// 実験的モデルロール
declare interface ExperimentalModelRoles {
  inlineEdit?: string;
  applyCodeBlock?: string;
  // 他の必要なプロパティ
}

// デフォルトコンテキストプロバイダ
declare interface DefaultContextProvider {
  name: string;
  description?: string;
  enabled?: boolean;
  params?: Record<string, any>;
  // 他の必要なプロパティ
}

// クイックアクション設定
declare interface QuickActionConfig {
  actions?: any[];
  enabled?: boolean;
  // 他の必要なプロパティ
}
