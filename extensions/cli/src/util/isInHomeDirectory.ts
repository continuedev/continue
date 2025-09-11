import os from "node:os";
import path from "node:path";

export function isInHomeDirectory(): boolean {
  const cwd = process.cwd();
  const homedir = os.homedir();
  const resolvedCwd = path.resolve(cwd);
  const resolvedHome = path.resolve(homedir);
  if (process.platform === "win32") {
    return resolvedCwd.toLowerCase() === resolvedHome.toLowerCase();
  }
  return resolvedCwd === resolvedHome;
}
