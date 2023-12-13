import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SerializedContinueConfig } from "../config";
import defaultConfig from "../config/default";

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

export function devDataPath(): string {
  const sPath = path.join(getContinueGlobalPath(), "dev_data");
  if (!fs.existsSync(sPath)) {
    fs.mkdirSync(sPath);
  }
  return sPath;
}

export function getDevDataFilePath(fileName: string): string {
  return path.join(devDataPath(), fileName);
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
