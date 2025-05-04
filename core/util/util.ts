import { ModelRole } from "@continuedev/config-yaml";
import { platform } from "os";

// 内部使用のためのContinueConfigの型定義
export interface ContinueConfig {
  experimental?: {
    modelRoles?: Record<string, any>;
  };
  [key: string]: any;
}

/**
 * オブジェクトのディープコピーを作成する
 * @param obj コピーするオブジェクト
 * @returns コピーされたオブジェクト
 */
export function copyOf<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 特定の役割に対応するモデルを取得する
 * @param config Continueの設定
 * @param role モデルの役割
 * @returns 該当するモデル、または undefined
 */
export function getModelByRole(config: ContinueConfig, role: string): any {
  if (!config.experimental?.modelRoles) {
    return undefined;
  }

  return config.experimental.modelRoles[role as keyof typeof config.experimental.modelRoles];
}

/**
 * LanceDBがLinux環境のCPUをサポートしているか確認する
 * @param ide IDE情報
 * @returns サポートされている場合はtrue、そうでない場合はfalse
 */
export function isSupportedLanceDbCpuTargetForLinux(ide: any): boolean {
  if (platform() !== "linux") {
    return true; // Linuxでなければサポートされているとみなす
  }

  try {
    // CPUアーキテクチャ情報の取得を試みる
    const arch = ide.getCpuArchitecture?.() || process.arch;
    return arch === "x64" || arch === "arm64"; // x64またはarm64のみサポート
  } catch (e) {
    console.warn("Error determining CPU architecture:", e);
    return false; // エラー発生時は安全側に倒してfalseを返す
  }
}

/**
 * プロンプトテンプレートをシリアライズする
 * @param promptTemplates プロンプトテンプレート
 * @returns シリアライズされたプロンプトテンプレート
 */
export function serializePromptTemplates(promptTemplates: any): any {
  if (!promptTemplates) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(promptTemplates));
  } catch (e) {
    console.warn("Error serializing prompt templates:", e);
    return undefined;
  }
}
