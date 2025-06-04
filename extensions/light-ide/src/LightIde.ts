import type { IDE, IdeInfo, IdeSettings, Problem, FileStatsMap, FileType, Range, RangeInFile, Location, Thread, ToastType, IndexTag, ContinueRcJson, TerminalOptions } from "core";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

export class LightIde implements IDE {
  private webviewProtocolPromise: Promise<any>;

  constructor(webviewProtocolPromise: Promise<any>) {
    this.webviewProtocolPromise = webviewProtocolPromise;
  }

  async getIdeInfo(): Promise<IdeInfo> {
    return {
      ideType: "vscode", // Or "node" if you prefer
      name: "LightIde",
      version: "1.0.0",
      remoteName: "local",
      extensionVersion: "1.0.0",
    };
  }

  async getIdeSettings(): Promise<IdeSettings> {
    return {
      remoteConfigServerUrl: undefined,
      remoteConfigSyncPeriod: 3600,
      userToken: "anonymous",
      continueTestEnvironment: "local",
      pauseCodebaseIndexOnStart: false,
    };
  }

  async getDiff(includeUnstaged: boolean): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git diff ${includeUnstaged ? "" : "--cached"} --name-only`);
      return stdout.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  async getClipboardContent(): Promise<{ text: string; copiedAt: string }> {
    return {
      text: "", // Clipboard not implemented
      copiedAt: new Date().toISOString(),
    };
  }

  async isTelemetryEnabled(): Promise<boolean> {
    return true;
  }

  async getUniqueId(): Promise<string> {
    return crypto.createHash("sha256").update(os.hostname()).digest("hex");
  }

  async getTerminalContents(): Promise<string> {
    return "";
  }

  async getDebugLocals(): Promise<string> {
    return "";
  }

  async getTopLevelCallStackSources(): Promise<string[]> {
    return [];
  }

  async getAvailableThreads(): Promise<Thread[]> {
    return [];
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return [process.cwd()];
  }

  async getWorkspaceConfigs(): Promise<ContinueRcJson[]> {
    try {
      const configPath = path.join(process.cwd(), ".continuerc.json");
      const content = await fs.readFile(configPath, "utf-8");
      return [JSON.parse(content)];
    } catch {
      return [];
    }
  }

  async fileExists(fileUri: string): Promise<boolean> {
    try {
      await fs.access(fileUri);
      return true;
    } catch {
      return false;
    }
  }

  async writeFile(filePath: string, contents: string): Promise<void> {
    await fs.writeFile(filePath, contents, "utf-8");
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    console.log(`--- ${title} ---\n${contents}`);
  }

  async openFile(filePath: string): Promise<void> {
    console.log(`Open file: ${filePath}`);
  }

  async openUrl(url: string): Promise<void> {
    const cmd = process.platform === "win32" ? `start "" "${url}"` :
                process.platform === "darwin" ? `open "${url}"` :
                `xdg-open "${url}"`;
    await execAsync(cmd);
  }

  async runCommand(command: string): Promise<void> {
    await execAsync(command);
  }

  async saveFile(fileUri: string): Promise<void> {
    return;
  }

  async readFile(fileUri: string): Promise<string> {
    return await fs.readFile(fileUri, "utf-8");
  }

  async readRangeInFile(fileUri: string, range: Range): Promise<string> {
    const content = await this.readFile(fileUri);
    const lines = content.split("\n").slice(range.start.line, range.end.line + 1);
    return lines.join("\n");
  }

  async showLines(fileUri: string, startLine: number, endLine: number): Promise<void> {
    const content = await this.readFile(fileUri);
    const lines = content.split("\n").slice(startLine, endLine + 1);
    console.log(lines.join("\n"));
  }

  async getOpenFiles(): Promise<string[]> {
    return [];
  }

  async getCurrentFile(): Promise<undefined | { isUntitled: boolean; path: string; contents: string }> {
    return undefined;
  }

  async getPinnedFiles(): Promise<string[]> {
    return [];
  }

  async getSearchResults(): Promise<string> {
    return "";
  }

  async getFileResults(): Promise<string[]> {
    return [];
  }

  async subprocess(command: string, cwd?: string): Promise<[string, string]> {
    const { stdout, stderr } = await execAsync(command, { cwd });
    return [stdout, stderr];
  }

  async getProblems(): Promise<Problem[]> {
    return [];
  }

  async getBranch(dir: string): Promise<string> {
    try {
      const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: dir });
      return stdout.trim();
    } catch {
      return "main";
    }
  }

  async getTags(): Promise<IndexTag[]> {
    return [];
  }

  async getRepoName(dir: string): Promise<string | undefined> {
    return path.basename(path.resolve(dir));
  }

  async showToast(type: ToastType, message: string): Promise<void> {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  async getGitRootPath(dir: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd: dir });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  async listDir(dir: string): Promise<[string, FileType][]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.map((entry) => [
      entry.name,
      entry.isDirectory() ? 2 : 1,
    ]);
  }

  async getFileStats(files: string[]): Promise<FileStatsMap> {
    const stats: FileStatsMap = {};
    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        stats[file] = {
          size: stat.size,
          lastModified: stat.mtimeMs,
        };
      } catch {}
    }
    return stats;
  }

  async readSecrets(): Promise<Record<string, string>> {
    return {};
  }

  async writeSecrets(): Promise<void> {
    return;
  }

  async gotoDefinition(): Promise<RangeInFile[]> {
    return [];
  }

  onDidChangeActiveTextEditor(_callback: (fileUri: string) => void): void {
    // Not supported in CLI
  }
}
