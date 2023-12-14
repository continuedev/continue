import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SerializedContinueConfig } from "..";
import defaultConfig from "../config/default";
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

export function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsFolderPath(), `${sessionId}.json`);
}

export function getSessionsListPath(): string {
  return path.join(getSessionsFolderPath(), "sessions.json");
}

export function getConfigJsonPath(): string {
  const p = path.join(getContinueGlobalPath(), "config.json");
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(defaultConfig, null, 2));
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
}`
    );
  }

  const node_modules_path = path.join(getContinueGlobalPath(), "node_modules");
  if (!fs.existsSync(node_modules_path)) {
    fs.mkdirSync(node_modules_path);
    fs.mkdirSync(path.join(node_modules_path, "@types"));
    fs.mkdirSync(path.join(node_modules_path, "@types/core"));
  }
  fs.writeFileSync(
    path.join(node_modules_path, "@types/core", "index.d.ts"),
    Types
  );
  return p;
}

export function getConfigJsPath(): string {
  // Do not create automatically
  return path.join(getContinueGlobalPath(), "config.js");
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
            allowJs: false,
            skipLibCheck: true,
            esModuleInterop: false,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            module: "System",
            moduleResolution: "Node",
            noEmit: false,
            noEmitOnError: false,
            outFile: "./config.js",
          },
          include: ["./config.ts"],
        },
        null,
        2
      )
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
  callback: (config: SerializedContinueConfig) => SerializedContinueConfig
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
