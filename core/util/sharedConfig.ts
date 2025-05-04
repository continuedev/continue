/**
 * 共有設定を適用するためのヘルパー関数
 * Continueの設定オブジェクトに共有設定を適用します
 */

export type AnyConfig = {
  [key: string]: any;
};

/**
 * 任意のConfigオブジェクトに共有設定を適用する関数
 * @param config 元の設定オブジェクト
 * @param sharedConfig 共有設定
 * @returns 共有設定が適用された設定オブジェクト
 */
export function modifyAnyConfigWithSharedConfig(
  config: AnyConfig,
  sharedConfig: AnyConfig | null
): AnyConfig {
  if (!sharedConfig) {
    return config;
  }

  // ディープコピーを作成
  const updatedConfig = JSON.parse(JSON.stringify(config));

  // 共有設定を適用
  Object.keys(sharedConfig).forEach((key) => {
    // 単純な上書き（必要に応じて拡張可能）
    if (sharedConfig[key] !== undefined) {
      updatedConfig[key] = sharedConfig[key];
    }
  });

  return updatedConfig;
}
