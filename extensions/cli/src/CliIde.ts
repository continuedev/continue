/**
 * CliIde — implements the core `IDE` interface for the CLI runtime.
 *
 * This lets the CLI use shared core tool implementations (readFile, git, grep,
 * subagent, team_*, etc.) from `core/tools/implementations/` without needing
 * VS Code. All file-system and process operations are done with Node.js APIs.
 *
 * URI handling: core tools pass `file://` URIs; this class converts to/from
 * plain paths internally using `fileURLToPath` / `pathToFileURL`.
 */

import * as child_process from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { promisify } from "util";

import {
  DocumentSymbol,
  FileStatsMap,
  FileType,
  GrepSearchOptions,
  IDE,
  IdeInfo,
  IdeSettings,
  IndexTag,
  Location,
  Problem,
  RangeInFile,
  Range,
  SignatureHelp,
  Thread,
} from "core";

import { env } from "./env.js";
import { getVersion } from "./version.js";

const execAsync = promisify(child_process.exec);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a file:// URI or plain path to an absolute filesystem path. */
function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return path.resolve(uri);
}

/** Run a git command in the given directory; returns trimmed stdout. */
async function gitOutput(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execAsync(`git ${args.join(" ")}`, { cwd });
  return stdout.trim();
}

// ─── CliIde ──────────────────────────────────────────────────────────────────

export class CliIde implements IDE {
  /** The working directory that counts as the workspace root. */
  private readonly workspaceDir: string;

  constructor(workspaceDir?: string) {
    this.workspaceDir = workspaceDir ?? process.cwd();
  }

  // ── Identity ──────────────────────────────────────────────────────────────

  async getIdeInfo(): Promise<IdeInfo> {
    return {
      ideType: "cli",
      name: "Yuto CLI",
      version: getVersion(),
      remoteName: "local",
      extensionVersion: getVersion(),
      isPrerelease: false,
    };
  }

  async getIdeSettings(): Promise<IdeSettings> {
    return {
      remoteConfigServerUrl: undefined,
      remoteConfigSyncPeriod: 60,
      userToken: "",
      continueTestEnvironment: "production",
      pauseCodebaseIndexOnStart: false,
    };
  }

  async getUniqueId(): Promise<string> {
    // Use a stable identifier derived from the machine's hostname + username.
    return `cli-${os.hostname()}-${os.userInfo().username}`;
  }

  async isTelemetryEnabled(): Promise<boolean> {
    return process.env.CONTINUE_TELEMETRY_ENABLED !== "false";
  }

  async isWorkspaceRemote(): Promise<boolean> {
    return false;
  }

  // ── Workspace ─────────────────────────────────────────────────────────────

  async getWorkspaceDirs(): Promise<string[]> {
    return [pathToFileURL(this.workspaceDir).href];
  }

  // ── File I/O ──────────────────────────────────────────────────────────────

  async fileExists(fileUri: string): Promise<boolean> {
    try {
      await fs.access(uriToPath(fileUri));
      return true;
    } catch {
      return false;
    }
  }

  async readFile(fileUri: string): Promise<string> {
    try {
      return await fs.readFile(uriToPath(fileUri), "utf8");
    } catch {
      return "";
    }
  }

  async readRangeInFile(fileUri: string, range: Range): Promise<string> {
    const contents = await this.readFile(fileUri);
    const lines = contents.split("\n");
    return lines.slice(range.start.line, range.end.line + 1).join("\n");
  }

  async writeFile(fileUri: string, contents: string): Promise<void> {
    const filePath = uriToPath(fileUri);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents, "utf8");
  }

  async removeFile(fileUri: string): Promise<void> {
    await fs.unlink(uriToPath(fileUri));
  }

  async saveFile(_fileUri: string): Promise<void> {
    // Files are written directly to disk; no-op for CLI.
  }

  async getFileStats(files: string[]): Promise<FileStatsMap> {
    const result: FileStatsMap = {};
    await Promise.all(
      files.map(async (fileUri) => {
        try {
          const stat = await fs.stat(uriToPath(fileUri));
          result[fileUri] = {
            lastModified: stat.mtimeMs,
            size: stat.size,
          };
        } catch {
          // skip missing files
        }
      }),
    );
    return result;
  }

  async listDir(dirUri: string): Promise<[string, FileType][]> {
    try {
      const dirPath = uriToPath(dirUri);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map((entry) => {
        let type = FileType.Unkown;
        if (entry.isDirectory()) type = FileType.Directory;
        else if (entry.isSymbolicLink()) type = FileType.SymbolicLink;
        else if (entry.isFile()) type = FileType.File;
        return [entry.name, type] as [string, FileType];
      });
    } catch {
      return [];
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async getSearchResults(
    query: string,
    options?: GrepSearchOptions,
  ): Promise<string> {
    const contextLines = options?.contextLines ?? 2;
    const args = [
      "rg",
      ...(options?.caseSensitive ? [] : ["-i"]),
      "--ignore-file",
      ".gitignore",
      "-C",
      String(contextLines),
      "--heading",
      ...(options?.includePattern ? ["--glob", options.includePattern] : []),
      ...(options?.multiline ? ["-U", "--multiline-dotall"] : []),
      ...(options?.maxResults ? ["-m", String(options.maxResults)] : []),
      "-e",
      query,
      ".",
    ];
    try {
      const { stdout } = await execAsync(args.join(" "), {
        cwd: this.workspaceDir,
      });
      return stdout;
    } catch (err: any) {
      // rg exits with code 1 when no matches found — that's fine
      if (err.code === 1) return "";
      throw err;
    }
  }

  async getFileResults(
    pattern: string,
    maxResults?: number,
  ): Promise<string[]> {
    const args = [
      "rg",
      "--files",
      "--iglob",
      pattern,
      "--ignore-file",
      ".gitignore",
      ...(maxResults ? ["--max-count", String(maxResults)] : []),
    ];
    try {
      const { stdout } = await execAsync(args.join(" "), {
        cwd: this.workspaceDir,
      });
      return stdout.split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  // ── Processes ─────────────────────────────────────────────────────────────

  async subprocess(command: string, cwd?: string): Promise<[string, string]> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd ?? this.workspaceDir,
      });
      return [stdout, stderr];
    } catch (err: any) {
      return [err.stdout ?? "", err.stderr ?? String(err)];
    }
  }

  async runCommand(command: string): Promise<void> {
    await execAsync(command, { cwd: this.workspaceDir });
  }

  // ── Git ───────────────────────────────────────────────────────────────────

  async getDiff(includeUnstaged: boolean): Promise<string[]> {
    try {
      const staged = await gitOutput(["diff", "--staged"], this.workspaceDir);
      if (!includeUnstaged) return staged ? [staged] : [];
      const unstaged = await gitOutput(["diff"], this.workspaceDir);
      return [staged, unstaged].filter(Boolean);
    } catch {
      return [];
    }
  }

  async getBranch(dir: string): Promise<string> {
    try {
      return await gitOutput(
        ["rev-parse", "--abbrev-ref", "HEAD"],
        uriToPath(dir),
      );
    } catch {
      return "unknown";
    }
  }

  async getGitRootPath(dir: string): Promise<string | undefined> {
    try {
      return await gitOutput(["rev-parse", "--show-toplevel"], uriToPath(dir));
    } catch {
      return undefined;
    }
  }

  async getRepoName(dir: string): Promise<string | undefined> {
    try {
      const url = await gitOutput(
        ["remote", "get-url", "origin"],
        uriToPath(dir),
      );
      const parts = url.replace(/\.git$/, "").split("/");
      return parts.slice(-2).join("/");
    } catch {
      return undefined;
    }
  }

  async getTags(artifactId: string): Promise<IndexTag[]> {
    const workspaceDirs = await this.getWorkspaceDirs();
    const tags: IndexTag[] = await Promise.all(
      workspaceDirs.map(async (dir) => ({
        directory: dir,
        branch: await this.getBranch(dir),
        artifactId,
      })),
    );
    return tags;
  }

  // ── Secrets ───────────────────────────────────────────────────────────────

  async readSecrets(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const val = process.env[key] ?? (await this._readSecretFromFile(key));
      if (val !== undefined) result[key] = val;
    }
    return result;
  }

  async writeSecrets(secrets: Record<string, string>): Promise<void> {
    const envFilePath = path.join(env.continueHome, ".env");
    let existing = "";
    try {
      existing = await fs.readFile(envFilePath, "utf8");
    } catch {
      // file doesn't exist yet
    }
    const lines = existing.split("\n").filter((l) => {
      const key = l.split("=")[0];
      return !Object.prototype.hasOwnProperty.call(secrets, key);
    });
    for (const [k, v] of Object.entries(secrets)) {
      lines.push(`${k}=${v}`);
    }
    await fs.mkdir(env.continueHome, { recursive: true });
    await fs.writeFile(envFilePath, lines.join("\n") + "\n", "utf8");
  }

  private async _readSecretFromFile(key: string): Promise<string | undefined> {
    const candidates = [
      path.join(env.continueHome, ".env"),
      path.join(this.workspaceDir, ".yutoagentic", ".env"),
      path.join(this.workspaceDir, ".env"),
    ];
    for (const envPath of candidates) {
      try {
        const content = await fs.readFile(envPath, "utf8");
        for (const line of content.split("\n")) {
          const eqIdx = line.indexOf("=");
          if (eqIdx === -1) continue;
          if (line.slice(0, eqIdx).trim() === key) {
            return line.slice(eqIdx + 1).trim();
          }
        }
      } catch {
        // file missing, continue
      }
    }
    return undefined;
  }

  // ── Toast / UI stubs ──────────────────────────────────────────────────────

  async showToast(
    type: "error" | "info" | "warning",
    message: string,
  ): Promise<void> {
    if (type === "error") {
      console.error(`[error] ${message}`);
    } else if (type === "warning") {
      console.warn(`[warn] ${message}`);
    } else {
      console.log(`[info] ${message}`);
    }
  }

  async showVirtualFile(_title: string, _contents: string): Promise<void> {}
  async openFile(_path: string): Promise<void> {}
  async openUrl(_url: string): Promise<void> {}
  async showLines(
    _fileUri: string,
    _startLine: number,
    _endLine: number,
  ): Promise<void> {}

  // ── Editor state stubs ────────────────────────────────────────────────────

  async getClipboardContent(): Promise<{ text: string; copiedAt: string }> {
    return { text: "", copiedAt: new Date().toISOString() };
  }

  async getTerminalContents(): Promise<string> {
    return "";
  }

  async getDebugLocals(_threadIndex: number): Promise<string> {
    return "";
  }

  async getTopLevelCallStackSources(
    _threadIndex: number,
    _stackDepth: number,
  ): Promise<string[]> {
    return [];
  }

  async getAvailableThreads(): Promise<Thread[]> {
    return [];
  }

  async getOpenFiles(): Promise<string[]> {
    return [];
  }

  async getCurrentFile(): Promise<
    undefined | { isUntitled: boolean; path: string; contents: string }
  > {
    return undefined;
  }

  async getPinnedFiles(): Promise<string[]> {
    return [];
  }

  async getProblems(_fileUri?: string): Promise<Problem[]> {
    return [];
  }

  // ── LSP stubs ─────────────────────────────────────────────────────────────

  async gotoDefinition(_location: Location): Promise<RangeInFile[]> {
    return [];
  }

  async gotoTypeDefinition(_location: Location): Promise<RangeInFile[]> {
    return [];
  }

  async getSignatureHelp(_location: Location): Promise<SignatureHelp | null> {
    return null;
  }

  async getReferences(_location: Location): Promise<RangeInFile[]> {
    return [];
  }

  async getDocumentSymbols(
    _textDocumentIdentifier: string,
  ): Promise<DocumentSymbol[]> {
    return [];
  }

  onDidChangeActiveTextEditor(_callback: (fileUri: string) => void): void {
    // No active editor in CLI.
  }
}
