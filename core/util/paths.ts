import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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
  // TODO: Create if it doesn't exist
  return path.join(getContinueGlobalPath(), "config.json");
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
