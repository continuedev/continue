import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as YAML from "yaml";

import { ConfigYaml, DevEventName } from "@continuedev/config-yaml";
import * as JSONC from "comment-json";
import dotenv from "dotenv";

import { IdeType, SerializedContinueConfig } from "../";
import { defaultConfig, defaultConfigJetBrains } from "../config/default";
import Types from "../config/types";

dotenv.config();

/**
 * 強化された normalizePath 関数 - 二重ドライブレター問題を改善
 * @param p 正規化するパス
 * @returns 正規化されたパス
 */
export function normalizePath(p: string): string {
  if (!p) return p;
  
  try {
    // Windowsパスの場合の特別な処理
    if (process.platform === 'win32') {
      // パスが長すぎる場合の保護（MAX_PATH = 260）
      const maxPathLength = 2048;
      if (p.length > maxPathLength) {
        p = p.substring(0, maxPathLength);
      }
      
      // 元のドライブレターを抽出
      const driveLetterMatch = p.match(/^([A-Za-z]:)/i);
      if (driveLetterMatch) {
        const driveLetter = driveLetterMatch[1];
        
        // すべての二重ドライブレターパターンをチェック
        const patterns = [
          /^([A-Za-z]:)[\\\/]+([A-Za-z]:)[\\\/]+/i,                    // C:\C:\ パターン
          /^([A-Za-z]:)[\\\/]+[^\\\/]+[\\\/]+([A-Za-z]:)[\\\/]+/i,     // C:\dir\C:\ パターン
          /^([A-Za-z]:)[\\\/]+[cC]:[\\\/]/i,                          // C:\c:\ パターン
          /^([A-Za-z]:)[\\\/]+[A-Za-z]:[\\\/]/i,                       // C:\D:\ パターン - 任意のドライブレター組み合わせ
          /^([A-Za-z]:).*[\\\/]+([A-Za-z]:)[\\\/]+/i                   // 途中にドライブレターが現れるパターン
        ];
        
        // 二重ドライブレターのパターンを持つかチェック
        let hasDriveLetter = false;
        for (const pattern of patterns) {
          if (pattern.test(p)) {
            hasDriveLetter = true;
            break;
          }
        }
        
        if (hasDriveLetter) {
          // 一番目のドライブレターのみ使用し、残りのパスを正規化
          const pathAfterDrive = p.substring(driveLetter.length);
          
          // すべてのドライブレター表現を取り除く（先頭の区切り文字は維持）
          let cleanedPath = pathAfterDrive.replace(/[\\\/]+[A-Za-z]:[\\\/]*/gi, '\\');
          
          // 連続するパス区切り文字を単一に
          cleanedPath = cleanedPath.replace(/[\\\/]{2,}/g, '\\');
          
          // 先頭のスラッシュが欠けていたら追加
          if (!cleanedPath.startsWith('\\')) {
            cleanedPath = '\\' + cleanedPath;
          }
          
          p = driveLetter + cleanedPath;
        }
      }
      
      // 連続するパス区切り文字を単一に
      p = p.replace(/[\\\/]{2,}/g, '\\');
    }
    
    // 最終的な正規化
    const normalizedPath = path.normalize(p);
    return normalizedPath;
  } catch (e) {
    // エラーは発生させず、元のパスを返す
    return p;
  }
}

/**
 * 安全にファイル読み込みを行う拡張関数
 * @param filepath 読み込むファイルのパス
 * @returns ファイルの内容か、エラー時はnull
 */
export function safeReadFile(filepath: string): string | null {
  try {
    // パスを正規化
    const normalizedPath = normalizePath(filepath);
    
    // ファイル存在チェックと読み込み
    if (fs.existsSync(normalizedPath)) {
      return fs.readFileSync(normalizedPath, 'utf8');
    }
  } catch (e) {
    // エラーは静かに処理（ログ出力なし）
  }
  return null;
}

/**
 * デバッグ環境用の設定ファイルパスを取得する関数
 * @param fileType 設定ファイルの種類
 * @returns 設定ファイルのパスまたはnull
 */
export function getDebugConfigPath(fileType: 'config' | 'mcpServer' = 'config'): string | null {
  // 開発モードかどうかを確認
  const isDevMode = process.env.NODE_ENV === 'development';
  
  if (!isDevMode) {
    return null;
  }
  
  try {
    const basePath = normalizePath(path.join(process.cwd(), "extensions", ".continue-debug"));
    
    if (fileType === 'config') {
      const configPath = path.join(basePath, "config.yaml");
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    } else if (fileType === 'mcpServer') {
      const mcpServerDir = path.join(basePath, "mcpServers");
      if (fs.existsSync(mcpServerDir)) {
        const databricksPath = path.join(mcpServerDir, "databricks.yaml");
        if (fs.existsSync(databricksPath)) {
          return databricksPath;
        }
        return mcpServerDir;
      }
    }
  } catch (e) {
    // エラーは静かに処理（ログ出力なし）
  }
  
  return null;
}

/**
 * 最初に見つかった利用可能なファイルを読み込む関数（改善版）
 * @param filepaths 検索するファイルパスの配列
 * @returns 見つかったファイル情報またはnull
 */
export function readFirstAvailableFile(filepaths: string[]): { path: string; content: string } | null {
  try {
    // 各パスを正規化
    const normalizedPaths = filepaths.map(filepath => {
      try {
        return normalizePath(filepath);
      } catch (e) {
        return filepath; // 正規化に失敗した場合は元のパスを使用
      }
    });
    
    // 正規化されたパスを使ってファイルを探す
    for (const filepath of normalizedPaths) {
      try {
        if (fs.existsSync(filepath)) {
          const content = fs.readFileSync(filepath, 'utf8');
          return { path: filepath, content };
        }
      } catch (e) {
        // 個別ファイルのエラーは静かに処理（続行）
        continue;
      }
    }
    
    // デバッグ用の設定ファイルも試す
    if (process.env.NODE_ENV === 'development') {
      try {
        const debugMcpPath = getDebugConfigPath('mcpServer');
        if (debugMcpPath && fs.existsSync(debugMcpPath)) {
          if (fs.statSync(debugMcpPath).isDirectory()) {
            const databricksPath = path.join(debugMcpPath, "databricks.yaml");
            if (fs.existsSync(databricksPath)) {
              const content = fs.readFileSync(databricksPath, 'utf8');
              return { path: databricksPath, content };
            }
          } else {
            const content = fs.readFileSync(debugMcpPath, 'utf8');
            return { path: debugMcpPath, content };
          }
        }
      } catch (e) {
        // デバッグ設定のエラーは静かに処理
      }
    }
  } catch (e) {
    // 全体的なエラーは静かに処理
  }
  
  return null;
}

const CONTINUE_GLOBAL_DIR = (() => {
  const configPath = process.env.CONTINUE_GLOBAL_DIR;
  if (configPath) {
    // Convert relative path to absolute paths based on current working directory
    return path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);
  }
  return path.join(os.homedir(), ".continue");
})();

export const DEFAULT_CONFIG_TS_CONTENTS = `export function modifyConfig(config: Config): Config {
  return config;
}`;

export function getChromiumPath(): string {
  return normalizePath(path.join(getContinueUtilsPath(), ".chromium-browser-snapshots"));
}

export function getContinueUtilsPath(): string {
  const utilsPath = normalizePath(path.join(getContinueGlobalPath(), ".utils"));
  if (!fs.existsSync(utilsPath)) {
    fs.mkdirSync(utilsPath);
  }
  return utilsPath;
}

export function getGlobalContinueIgnorePath(): string {
  const continueIgnorePath = normalizePath(path.join(
    getContinueGlobalPath(),
    ".continueignore",
  ));
  if (!fs.existsSync(continueIgnorePath)) {
    fs.writeFileSync(continueIgnorePath, "");
  }
  return continueIgnorePath;
}

export function getContinueGlobalPath(): string {
  // This is ~/.continue on mac/linux
  const continuePath = normalizePath(CONTINUE_GLOBAL_DIR);
  if (!fs.existsSync(continuePath)) {
    fs.mkdirSync(continuePath);
  }
  return continuePath;
}

export function getSessionsFolderPath(): string {
  const sessionsPath = normalizePath(path.join(getContinueGlobalPath(), "sessions"));
  if (!fs.existsSync(sessionsPath)) {
    fs.mkdirSync(sessionsPath);
  }
  return sessionsPath;
}

export function getIndexFolderPath(): string {
  const indexPath = normalizePath(path.join(getContinueGlobalPath(), "index"));
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(indexPath);
  }
  return indexPath;
}

export function getGlobalContextFilePath(): string {
  return normalizePath(path.join(getIndexFolderPath(), "globalContext.json"));
}

export function getSharedConfigFilePath(): string {
  return normalizePath(path.join(getContinueGlobalPath(), "sharedConfig.json"));
}

export function getSessionFilePath(sessionId: string): string {
  return normalizePath(path.join(getSessionsFolderPath(), `${sessionId}.json`));
}

export function getSessionsListPath(): string {
  const filepath = normalizePath(path.join(getSessionsFolderPath(), "sessions.json"));
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify([]));
  }
  return filepath;
}

export function getConfigJsonPath(): string {
  const p = normalizePath(path.join(getContinueGlobalPath(), "config.json"));
  return p;
}

/**
 * デバッグモードを考慮した設定ファイルパス取得
 * @param ideType IDE種別
 * @returns 設定ファイルのパス
 */
export function getConfigYamlPath(ideType?: IdeType): string {
  try {
    // デバッグ用設定ファイルがあれば優先（開発モード時）
    const debugConfigPath = getDebugConfigPath('config');
    if (debugConfigPath && fs.existsSync(debugConfigPath)) {
      return normalizePath(debugConfigPath);
    }
    
    // 通常の設定ファイルパス
    const p = normalizePath(path.join(getContinueGlobalPath(), "config.yaml"));
    if (!fs.existsSync(p) && !fs.existsSync(getConfigJsonPath())) {
      if (ideType === "jetbrains") {
        fs.writeFileSync(p, YAML.stringify(defaultConfigJetBrains));
      } else {
        fs.writeFileSync(p, YAML.stringify(defaultConfig));
      }
    }
    return p;
  } catch (e) {
    // エラーが発生した場合はデフォルトパスを返す
    return path.join(getContinueGlobalPath(), "config.yaml");
  }
}

export function getPrimaryConfigFilePath(): string {
  const configYamlPath = getConfigYamlPath();
  if (fs.existsSync(configYamlPath)) {
    return configYamlPath;
  }
  return getConfigJsonPath();
}

export function getConfigTsPath(): string {
  const p = normalizePath(path.join(getContinueGlobalPath(), "config.ts"));
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, DEFAULT_CONFIG_TS_CONTENTS);
  }

  const typesPath = normalizePath(path.join(getContinueGlobalPath(), "types"));
  if (!fs.existsSync(typesPath)) {
    fs.mkdirSync(typesPath);
  }
  const corePath = normalizePath(path.join(typesPath, "core"));
  if (!fs.existsSync(corePath)) {
    fs.mkdirSync(corePath);
  }
  const packageJsonPath = normalizePath(path.join(getContinueGlobalPath(), "package.json"));
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({
        name: "continue-config",
        version: "1.0.0",
        description: "My Continue Configuration",
        main: "config.js",
      }),
    );
  }

  fs.writeFileSync(path.join(corePath, "index.d.ts"), Types);
  return p;
}

export function getConfigJsPath(): string {
  // Do not create automatically
  return normalizePath(path.join(getContinueGlobalPath(), "out", "config.js"));
}

export function getTsConfigPath(): string {
  const tsConfigPath = normalizePath(path.join(getContinueGlobalPath(), "tsconfig.json"));
  if (!fs.existsSync(tsConfigPath)) {
    fs.writeFileSync(
      tsConfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ESNext",
            useDefineForClassFields: true,
            lib: ["DOM", "DOM.Iterable", "ESNext"],
            allowJs: true,
            skipLibCheck: true,
            esModuleInterop: false,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            module: "System",
            moduleResolution: "Node",
            noEmit: false,
            noEmitOnError: false,
            outFile: "./out/config.js",
            typeRoots: ["./node_modules/@types", "./types"],
          },
          include: ["./config.ts"],
        },
        null,
        2,
      ),
    );
  }
  return tsConfigPath;
}

export function getContinueRcPath(): string {
  // Disable indexing of the config folder to prevent infinite loops
  const continuercPath = normalizePath(path.join(getContinueGlobalPath(), ".continuerc.json"));
  if (!fs.existsSync(continuercPath)) {
    fs.writeFileSync(
      continuercPath,
      JSON.stringify(
        {
          disableIndexing: true,
        },
        null,
        2,
      ),
    );
  }
  return continuercPath;
}

function getDevDataPath(): string {
  const sPath = normalizePath(path.join(getContinueGlobalPath(), "dev_data"));
  if (!fs.existsSync(sPath)) {
    fs.mkdirSync(sPath);
  }
  return sPath;
}

export function getDevDataSqlitePath(): string {
  return normalizePath(path.join(getDevDataPath(), "devdata.sqlite"));
}

export function getDevDataFilePath(
  eventName: DevEventName,
  schema: string,
): string {
  const versionPath = normalizePath(path.join(getDevDataPath(), schema));
  if (!fs.existsSync(versionPath)) {
    fs.mkdirSync(versionPath);
  }
  return normalizePath(path.join(versionPath, `${String(eventName)}.jsonl`));
}

function editConfigJson(
  callback: (config: SerializedContinueConfig) => SerializedContinueConfig,
): void {
  try {
    const configJsonPath = getConfigJsonPath();
    if (!fs.existsSync(configJsonPath)) {
      return;
    }
    
    const config = fs.readFileSync(configJsonPath, "utf8");
    let configJson = JSONC.parse(config);
    // Check if it's an object
    if (typeof configJson === "object" && configJson !== null) {
      configJson = callback(configJson as any) as any;
      fs.writeFileSync(configJsonPath, JSONC.stringify(configJson, null, 2));
    }
  } catch (e) {
    // エラーは静かに処理
  }
}

function editConfigYaml(callback: (config: ConfigYaml) => ConfigYaml): void {
  try {
    const configYamlPath = getConfigYamlPath();
    if (!fs.existsSync(configYamlPath)) {
      return;
    }
    
    const config = fs.readFileSync(configYamlPath, "utf8");
    let configYaml = YAML.parse(config);
    // Check if it's an object
    if (typeof configYaml === "object" && configYaml !== null) {
      configYaml = callback(configYaml as any) as any;
      fs.writeFileSync(configYamlPath, YAML.stringify(configYaml));
    }
  } catch (e) {
    // エラーは静かに処理
  }
}

export function editConfigFile(
  configJsonCallback: (
    config: SerializedContinueConfig,
  ) => SerializedContinueConfig,
  configYamlCallback: (config: ConfigYaml) => ConfigYaml,
): void {
  try {
    if (fs.existsSync(getConfigYamlPath())) {
      editConfigYaml(configYamlCallback);
    } else if (fs.existsSync(getConfigJsonPath())) {
      editConfigJson(configJsonCallback);
    }
  } catch (e) {
    // エラーは静かに処理
  }
}

function getMigrationsFolderPath(): string {
  const migrationsPath = normalizePath(path.join(getContinueGlobalPath(), ".migrations"));
  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath);
  }
  return migrationsPath;
}

export async function migrate(
  id: string,
  callback: () => void | Promise<void>,
  onAlreadyComplete?: () => void,
) {
  if (process.env.NODE_ENV === "test") {
    return await Promise.resolve(callback());
  }

  try {
    const migrationsPath = getMigrationsFolderPath();
    const migrationPath = normalizePath(path.join(migrationsPath, id));

    if (!fs.existsSync(migrationPath)) {
      try {
        fs.writeFileSync(migrationPath, "");
        await Promise.resolve(callback());
      } catch (e) {
        // エラーは静かに処理
      }
    } else if (onAlreadyComplete) {
      onAlreadyComplete();
    }
  } catch (e) {
    // エラーは静かに処理
  }
}

export function getIndexSqlitePath(): string {
  return normalizePath(path.join(getIndexFolderPath(), "index.sqlite"));
}

export function getLanceDbPath(): string {
  return normalizePath(path.join(getIndexFolderPath(), "lancedb"));
}

export function getTabAutocompleteCacheSqlitePath(): string {
  return normalizePath(path.join(getIndexFolderPath(), "autocompleteCache.sqlite"));
}

export function getDocsSqlitePath(): string {
  return normalizePath(path.join(getIndexFolderPath(), "docs.sqlite"));
}

export function getRemoteConfigsFolderPath(): string {
  const dir = normalizePath(path.join(getContinueGlobalPath(), ".configs"));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
}

export function getPathToRemoteConfig(remoteConfigServerUrl: string): string {
  let url: URL | undefined = undefined;
  try {
    url =
      typeof remoteConfigServerUrl !== "string" || remoteConfigServerUrl === ""
        ? undefined
        : new URL(remoteConfigServerUrl);
  } catch (e) {}
  const dir = normalizePath(path.join(getRemoteConfigsFolderPath(), url?.hostname ?? "None"));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
}

export function getConfigJsonPathForRemote(
  remoteConfigServerUrl: string,
): string {
  return normalizePath(path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.json"));
}

export function getConfigJsPathForRemote(
  remoteConfigServerUrl: string,
): string {
  return normalizePath(path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.js"));
}

export function getContinueDotEnv(): { [key: string]: string } {
  const filepath = normalizePath(path.join(getContinueGlobalPath(), ".env"));
  if (fs.existsSync(filepath)) {
    try {
      return dotenv.parse(fs.readFileSync(filepath));
    } catch (e) {
      // エラーは静かに処理
      return {};
    }
  }
  return {};
}

export function getLogsDirPath(): string {
  const logsPath = normalizePath(path.join(getContinueGlobalPath(), "logs"));
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath);
  }
  return logsPath;
}

export function getCoreLogsPath(): string {
  return normalizePath(path.join(getLogsDirPath(), "core.log"));
}

export function getPromptLogsPath(): string {
  return normalizePath(path.join(getLogsDirPath(), "prompt.log"));
}

export function getGlobalFolderWithName(name: string): string {
  return normalizePath(path.join(getContinueGlobalPath(), name));
}

export function getGlobalPromptsPath(): string {
  return getGlobalFolderWithName("prompts");
}

export function getGlobalAssistantsPath(): string {
  return getGlobalFolderWithName("assistants");
}

export function readAllGlobalPromptFiles(
  folderPath: string = getGlobalPromptsPath(),
): { path: string; content: string }[] {
  if (!fs.existsSync(folderPath)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(folderPath);
    const promptFiles: { path: string; content: string }[] = [];
    
    for (const file of files) {
      try {
        const filepath = normalizePath(path.join(folderPath, file));
        const stats = fs.statSync(filepath);

        if (stats.isDirectory()) {
          const nestedPromptFiles = readAllGlobalPromptFiles(filepath);
          promptFiles.push(...nestedPromptFiles);
        } else if (file.endsWith(".prompt")) {
          const content = fs.readFileSync(filepath, "utf8");
          promptFiles.push({ path: filepath, content });
        }
      } catch (e) {
        // 個別ファイルのエラーは静かに処理
        continue;
      }
    }

    return promptFiles;
  } catch (e) {
    // エラーは静かに処理
    return [];
  }
}

export function getRepoMapFilePath(): string {
  return normalizePath(path.join(getContinueUtilsPath(), "repo_map.txt"));
}

export function getEsbuildBinaryPath(): string {
  return normalizePath(path.join(getContinueUtilsPath(), "esbuild"));
}

export function migrateV1DevDataFiles() {
  try {
    const devDataPath = getDevDataPath();
    
    function moveToV1FolderIfExists(
      oldFileName: string,
      newFileName: DevEventName,
    ) {
      try {
        const oldFilePath = normalizePath(path.join(devDataPath, `${oldFileName}.jsonl`));
        if (fs.existsSync(oldFilePath)) {
          const newFilePath = getDevDataFilePath(newFileName, "0.1.0");
          if (!fs.existsSync(newFilePath)) {
            fs.copyFileSync(oldFilePath, newFilePath);
            fs.unlinkSync(oldFilePath);
          }
        }
      } catch (e) {
        // エラーは静かに処理
      }
    }
    
    moveToV1FolderIfExists("tokens_generated", "tokensGenerated");
    moveToV1FolderIfExists("chat", "chatFeedback");
    moveToV1FolderIfExists("quickEdit", "quickEdit");
    moveToV1FolderIfExists("autocomplete", "autocomplete");
  } catch (e) {
    // エラーは静かに処理
  }
}

export function getLocalEnvironmentDotFilePath(): string {
  return normalizePath(path.join(getContinueGlobalPath(), ".local"));
}

export function getStagingEnvironmentDotFilePath(): string {
  return normalizePath(path.join(getContinueGlobalPath(), ".staging"));
}

export function getDiffsDirectoryPath(): string {
  const diffsPath = normalizePath(path.join(getContinueGlobalPath(), ".diffs"));
  
  if (!fs.existsSync(diffsPath)) {
    try {
      fs.mkdirSync(diffsPath, {
        recursive: true,
      });
    } catch (e) {
      // エラーは静かに処理
    }
  }
  return diffsPath;
}