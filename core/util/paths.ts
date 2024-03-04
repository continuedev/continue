import dotenv from "dotenv";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { IdeType, SerializedContinueConfig } from "..";
import { defaultConfig, defaultConfigJetBrains } from "../config/default";
import Types from "../config/types";

export function getContinueGlobalPath(): string {
  // This is ~/.continue on mac/linux
  const continuePath = path.join(os.homedir(), ".continue");
  if (!fs.existsSync(continuePath)) {
    fs.mkdirSync(continuePath);
  }
  return continuePath;
}

export function getSessionsFolderPath(): string {
  const sessionsPath = path.join(getContinueGlobalPath(), "sessions");
  if (!fs.existsSync(sessionsPath)) {
    fs.mkdirSync(sessionsPath);
  }
  return sessionsPath;
}

export function getIndexFolderPath(): string {
  const indexPath = path.join(getContinueGlobalPath(), "index");
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(indexPath);
  }
  return indexPath;
}

export function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsFolderPath(), `${sessionId}.json`);
}

export function getSessionsListPath(): string {
  const filepath = path.join(getSessionsFolderPath(), "sessions.json");
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify([]));
  }
  return filepath;
}

export function getConfigJsonPath(ideType: IdeType = "vscode"): string {
  const p = path.join(getContinueGlobalPath(), "config.json");
  if (!fs.existsSync(p)) {
    if (ideType === "jetbrains") {
      fs.writeFileSync(p, JSON.stringify(defaultConfigJetBrains, null, 2));
    } else {
      fs.writeFileSync(p, JSON.stringify(defaultConfig, null, 2));
    }
  }
  return p;
}

export function getConfigTsPath(): string {
  const p = path.join(getContinueGlobalPath(), "config.ts");
  if (!fs.existsSync(p)) {
    fs.writeFileSync(
      p,
      `export function modifyConfig(config: Config): Config {
  return config;
}`,
    );
  }

  const typesPath = path.join(getContinueGlobalPath(), "types");
  if (!fs.existsSync(typesPath)) {
    fs.mkdirSync(typesPath);
  }
  const corePath = path.join(typesPath, "core");
  if (!fs.existsSync(corePath)) {
    fs.mkdirSync(corePath);
  }
  const packageJsonPath = path.join(getContinueGlobalPath(), "package.json");
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
  return path.join(getContinueGlobalPath(), "out", "config.js");
}

export function getTsConfigPath(): string {
  const tsConfigPath = path.join(getContinueGlobalPath(), "tsconfig.json");
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

export function devDataPath(): string {
  const sPath = path.join(getContinueGlobalPath(), "dev_data");
  if (!fs.existsSync(sPath)) {
    fs.mkdirSync(sPath);
  }
  return sPath;
}

export function getDevDataFilePath(fileName: string): string {
  return path.join(devDataPath(), fileName + ".jsonl");
}

export function editConfigJson(
  callback: (config: SerializedContinueConfig) => SerializedContinueConfig,
) {
  const config = fs.readFileSync(getConfigJsonPath(), "utf8");
  let configJson = JSON.parse(config);
  configJson = callback(configJson);
  fs.writeFileSync(getConfigJsonPath(), JSON.stringify(configJson, null, 2));
  return configJson;
}

function getMigrationsFolderPath(): string {
  const migrationsPath = path.join(getContinueGlobalPath(), ".migrations");
  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath);
  }
  return migrationsPath;
}

export function migrate(id: string, callback: () => void) {
  const migrationsPath = getMigrationsFolderPath();
  const migrationPath = path.join(migrationsPath, id);
  if (!fs.existsSync(migrationPath)) {
    fs.writeFileSync(migrationPath, "");
    callback();
  }
}

export function getIndexSqlitePath(): string {
  return path.join(getIndexFolderPath(), "index.sqlite");
}

export function getLanceDbPath(): string {
  return path.join(getIndexFolderPath(), "lancedb");
}

export function getTabAutocompleteCacheSqlitePath(): string {
  return path.join(getIndexFolderPath(), "autocompleteCache.sqlite");
}

export function getDocsSqlitePath(): string {
  return path.join(getIndexFolderPath(), "docs.sqlite");
}

export function getRemoteConfigsFolderPath(): string {
  const dir = path.join(getContinueGlobalPath(), ".configs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
}

export function getPathToRemoteConfig(remoteConfigServerUrl: URL): string {
  const dir = path.join(
    getRemoteConfigsFolderPath(),
    remoteConfigServerUrl.hostname,
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
}

export function getConfigJsonPathForRemote(remoteConfigServerUrl: URL): string {
  return path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.json");
}

export function getConfigJsPathForRemote(remoteConfigServerUrl: URL): string {
  return path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.js");
}

export function getContinueDotEnv(): { [key: string]: string } {
  const filepath = path.join(getContinueGlobalPath(), ".env");
  if (fs.existsSync(filepath)) {
    return dotenv.parse(fs.readFileSync(filepath));
  } else {
    return {};
  }
}

export function getCoreLogsPath(): string {
  return path.join(getContinueGlobalPath(), "core.log");
}
