import { ModelDescription, SerializedContinueConfig } from "core";
<<<<<<< HEAD
// import Mock from "core/llm/llms/Mock.js";
=======
import { IDE } from "core/index.js";
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { FromIdeProtocol, ToIdeProtocol } from "core/protocol/index.js";
import { IMessenger } from "core/protocol/messenger";
import FileSystemIde from "core/util/filesystem";
import fs from "fs";
import {
  ChildProcessWithoutNullStreams,
  execSync,
  spawn,
} from "node:child_process";
import path from "path";
import {
  CoreBinaryMessenger,
  CoreBinaryTcpMessenger,
} from "../src/IpcMessenger";

<<<<<<< HEAD
// jest.setTimeout(100_000);
=======
/**
 * Handles IDE messages from the binary subprocess, responding with plain data
 * matching the Kotlin CoreMessenger format: { messageType, data, messageId }.
 *
 * This bypasses the JS _handleLine auto-wrapper which would double-wrap
 * responses in { done, content, status }.
 */
class BinaryIdeHandler {
  private ide: IDE;
  private subprocess: ChildProcessWithoutNullStreams;
  private handlers: Record<string, (data: any) => Promise<any> | any> = {};
  private unfinishedLine: string | undefined;

  constructor(subprocess: ChildProcessWithoutNullStreams, ide: IDE) {
    this.ide = ide;
    this.subprocess = subprocess;
    this.registerHandlers();

    // Listen on stdout alongside CoreBinaryMessenger (EventEmitter allows multiple listeners)
    // Use setEncoding so split multibyte UTF-8 characters are decoded correctly
    subprocess.stdout.setEncoding("utf8");
    subprocess.stdout.on("data", (data: string) => this.handleData(data));
  }

  private registerHandlers() {
    const ide = this.ide;
    const h = this.handlers;
    h["getIdeInfo"] = () => ide.getIdeInfo();
    h["getIdeSettings"] = () => ide.getIdeSettings();
    h["getControlPlaneSessionInfo"] = () => undefined;
    h["getWorkspaceDirs"] = () => ide.getWorkspaceDirs();
    h["readFile"] = (d) => ide.readFile(d.filepath);
    h["writeFile"] = (d) => ide.writeFile(d.path, d.contents);
    h["fileExists"] = (d) => ide.fileExists(d.filepath);
    h["showLines"] = (d) => ide.showLines(d.filepath, d.startLine, d.endLine);
    h["openFile"] = (d) => ide.openFile(d.path);
    h["openUrl"] = (d) => ide.openUrl(d.url);
    h["runCommand"] = (d) => ide.runCommand(d.command);
    h["saveFile"] = (d) => ide.saveFile(d.filepath);
    h["readRangeInFile"] = (d) => ide.readRangeInFile(d.filepath, d.range);
    h["getFileStats"] = (d) => ide.getFileStats(d.files);
    h["getGitRootPath"] = (d) => ide.getGitRootPath(d.dir);
    h["listDir"] = (d) => ide.listDir(d.dir);
    h["getRepoName"] = (d) => ide.getRepoName(d.dir);
    h["getTags"] = (d) => ide.getTags(d);
    h["isTelemetryEnabled"] = () => ide.isTelemetryEnabled();
    h["isWorkspaceRemote"] = () => false;
    h["getUniqueId"] = () => ide.getUniqueId();
    h["getDiff"] = (d) => ide.getDiff(d.includeUnstaged);
    h["getTerminalContents"] = () => ide.getTerminalContents();
    h["getOpenFiles"] = () => ide.getOpenFiles();
    h["getCurrentFile"] = () => ide.getCurrentFile();
    h["getPinnedFiles"] = () => ide.getPinnedFiles();
    h["getSearchResults"] = (d) => ide.getSearchResults(d.query, d.maxResults);
    h["getFileResults"] = (d) => ide.getFileResults(d.pattern);
    h["getProblems"] = (d) => ide.getProblems(d.filepath);
    h["getBranch"] = (d) => ide.getBranch(d.dir);
    h["subprocess"] = (d) => ide.subprocess(d.command, d.cwd);
    h["getDebugLocals"] = (d) => ide.getDebugLocals(d.threadIndex);
    h["getAvailableThreads"] = () => ide.getAvailableThreads();
    h["getTopLevelCallStackSources"] = (d) =>
      ide.getTopLevelCallStackSources(d.threadIndex, d.stackDepth);
    h["showToast"] = () => {};
    h["readSecrets"] = (d) => ide.readSecrets(d.keys);
    h["writeSecrets"] = (d) => ide.writeSecrets(d.secrets);
    h["removeFile"] = (d) => ide.removeFile(d.path);
  }

  private handleData(data: string) {
    const d = data;
    const lines = d.split(/\r\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return;

    if (this.unfinishedLine) {
      lines[0] = this.unfinishedLine + lines[0];
      this.unfinishedLine = undefined;
    }
    if (!d.endsWith("\r\n")) {
      this.unfinishedLine = lines.pop();
    }
    lines.forEach((line) => this.handleLine(line));
  }

  private async handleLine(line: string) {
    let msg: { messageType: string; messageId: string; data?: any };
    try {
      msg = JSON.parse(line);
    } catch {
      return; // not JSON, ignore
    }

    const handler = this.handlers[msg.messageType];
    if (!handler) return; // not an IDE message, let CoreBinaryMessenger handle it

    try {
      const result = await handler(msg.data);
      this.respond(msg.messageType, result, msg.messageId);
    } catch (e) {
      this.respond(msg.messageType, undefined, msg.messageId);
    }
  }

  private respond(messageType: string, data: any, messageId: string) {
    const response = JSON.stringify({ messageType, data, messageId });
    this.subprocess.stdin.write(response + "\r\n");
  }
}

jest.setTimeout(30_000);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

const USE_TCP = false;

function autodetectPlatformAndArch() {
  const platform = {
    aix: "linux",
    darwin: "darwin",
    freebsd: "linux",
    linux: "linux",
    openbsd: "linux",
    sunos: "linux",
    win32: "win32",
    android: "linux",
    cygwin: "win32",
    netbsd: "linux",
    haiku: "linux",
  }[process.platform];
  const arch = {
    arm: "arm64",
    arm64: "arm64",
    ia32: "x64",
    loong64: "arm64",
    mips: "arm64",
    mipsel: "arm64",
    ppc: "x64",
    ppc64: "x64",
    riscv64: "arm64",
    s390: "x64",
    s390x: "x64",
    x64: "x64",
  }[process.arch];
  return [platform, arch];
}

const CONTINUE_GLOBAL_DIR = path.join(__dirname, "..", ".continue");
if (fs.existsSync(CONTINUE_GLOBAL_DIR)) {
  fs.rmSync(CONTINUE_GLOBAL_DIR, { recursive: true, force: true });
}
fs.mkdirSync(CONTINUE_GLOBAL_DIR);

describe("Test Suite", () => {
  let messenger: IMessenger<ToIdeProtocol, FromIdeProtocol>;
  let subprocess: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    const [platform, arch] = autodetectPlatformAndArch();
    const binaryDir = path.join(__dirname, "..", "bin", `${platform}-${arch}`);
    const exe = platform === "win32" ? ".exe" : "";
    const binaryPath = path.join(binaryDir, `continue-binary${exe}`);
    const expectedItems = [
      `continue-binary${exe}`,
      `rg${exe}`,
      "index.node",
      "package.json",
      "build/Release/node_sqlite3.node",
    ];
    expectedItems.forEach((item) => {
      expect(fs.existsSync(path.join(binaryDir, item))).toBe(true);
    });

    // Set execute permissions and remove quarantine attribute if on macOS
    if (platform !== "win32") {
      try {
        fs.chmodSync(binaryPath, 0o755);
        console.log("Execute permissions set for the binary");

        if (platform === "darwin") {
          const indexNodePath = path.join(binaryDir, "index.node");
          const filesToUnquarantine = [binaryPath, indexNodePath];

          for (const file of filesToUnquarantine) {
            try {
              execSync(`xattr -d com.apple.quarantine "${file}"`, {
                stdio: "ignore",
              });
              console.log(
                `Quarantine attribute removed from ${path.basename(file)}`,
              );
            } catch (error) {
              console.warn(
                `Failed to remove quarantine attribute from ${path.basename(file)}:`,
                error,
              );
            }
          }
        }
      } catch (error) {
        console.error(
          "Error setting permissions or removing quarantine:",
          error,
        );
      }
    }

    if (USE_TCP) {
      messenger = new CoreBinaryTcpMessenger<ToIdeProtocol, FromIdeProtocol>();
    } else {
      try {
        subprocess = spawn(binaryPath, {
          env: { ...process.env, CONTINUE_GLOBAL_DIR },
        });
        console.log("Successfully spawned subprocess");
      } catch (error) {
        console.error("Error spawning subprocess:", error);
        throw error;
      }
<<<<<<< HEAD
=======

      subprocess.stderr.on("data", (data: Buffer) => {
        console.error(`[stderr] ${data.toString()}`);
      });

>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      messenger = new CoreBinaryMessenger<ToIdeProtocol, FromIdeProtocol>(
        subprocess,
      );
    }

    const testDir = path.join(__dirname, "..", ".test");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    const ide = new FileSystemIde(testDir);
<<<<<<< HEAD
    // const reverseIde = new ReverseMessageIde(messenger.on.bind(messenger), ide);
=======
    if (!USE_TCP && subprocess) {
      new BinaryIdeHandler(subprocess, ide);
    }
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

    // Wait for core to set itself up
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Wait for the subprocess to exit
    if (USE_TCP) {
      (
        messenger as CoreBinaryTcpMessenger<ToIdeProtocol, FromIdeProtocol>
      ).close();
    } else if (subprocess) {
      subprocess.kill();
      await new Promise((resolve) => subprocess.on("close", resolve));
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

<<<<<<< HEAD
  it("should respond to ping with pong", async () => {
    const resp = await messenger.request("ping", "ping");
=======
  // Binary responses are wrapped in { done, content, status } by _handleLine.
  // This helper unwraps them, matching how the Kotlin CoreMessenger reads responses.
  async function request(messageType: string, data: any): Promise<any> {
    const resp = await messenger.request(messageType as any, data);
    return resp?.content !== undefined ? resp.content : resp;
  }

  it("should respond to ping with pong", async () => {
    const resp = await request("ping", "ping");
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    expect(resp).toBe("pong");
  });

  it("should create .continue directory at the specified location with expected files", async () => {
    expect(fs.existsSync(CONTINUE_GLOBAL_DIR)).toBe(true);

    // Many of the files are only created when trying to load the config
<<<<<<< HEAD
    const config = await messenger.request(
      "config/getSerializedProfileInfo",
      undefined,
    );

    const expectedFiles = [
      "config.json",
      "config.ts",
      "package.json",
      "logs/core.log",
      "index/autocompleteCache.sqlite",
      "types/core/index.d.ts",
    ];
=======
    await request("config/getSerializedProfileInfo", undefined);

    const expectedFiles = ["logs/core.log", "index/autocompleteCache.sqlite"];
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

    const missingFiles = expectedFiles.filter((file) => {
      const filePath = path.join(CONTINUE_GLOBAL_DIR, file);
      return !fs.existsSync(filePath);
    });

    expect(missingFiles).toEqual([]);
    if (missingFiles.length > 0) {
      console.log("Missing files:", missingFiles);
    }
  });

  it("should return valid config object", async () => {
<<<<<<< HEAD
    const { result } = await messenger.request(
=======
    const { result } = await request(
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      "config/getSerializedProfileInfo",
      undefined,
    );
    const { config } = result;
<<<<<<< HEAD
    expect(config).toHaveProperty("models");
    expect(config).toHaveProperty("embeddingsProvider");
=======
    expect(config).toHaveProperty("modelsByRole");
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    expect(config).toHaveProperty("contextProviders");
    expect(config).toHaveProperty("slashCommands");
  });

  it("should properly handle history requests", async () => {
    const sessionId = "test-session-id";
<<<<<<< HEAD
    await messenger.request("history/save", {
      history: [],
      sessionId,
      title: "test-title",

      workspaceDirectory: "test-workspace-directory",
    });
    const sessions = await messenger.request("history/list", {});
    expect(sessions.length).toBeGreaterThan(0);

    const session = await messenger.request("history/load", {
=======
    await request("history/save", {
      history: [],
      sessionId,
      title: "test-title",
      workspaceDirectory: "test-workspace-directory",
    });
    const sessions = await request("history/list", {});
    expect(sessions.length).toBeGreaterThan(0);

    const session = await request("history/load", {
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      id: sessionId,
    });
    expect(session).toHaveProperty("history");

<<<<<<< HEAD
    await messenger.request("history/delete", {
      id: sessionId,
    });
    const sessionsAfterDelete = await messenger.request("history/list", {});
=======
    await request("history/delete", {
      id: sessionId,
    });
    const sessionsAfterDelete = await request("history/list", {});
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    expect(sessionsAfterDelete.length).toBe(sessions.length - 1);
  });

  it("should add and delete a model from config.json", async () => {
    const model: SerializedContinueConfig["models"][number] = {
      title: "Test Model",
      provider: "openai",
      model: "gpt-3.5-turbo",
      underlyingProviderName: "openai",
    };
<<<<<<< HEAD
    await messenger.request("config/addModel", {
      model,
    });
    const {
      result: { config },
    } = await messenger.request("config/getSerializedProfileInfo", undefined);
=======
    await request("config/addModel", { model });
    const {
      result: { config },
    } = await request("config/getSerializedProfileInfo", undefined);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

    expect(
      config!.modelsByRole.chat.some(
        (m: ModelDescription) => m.title === model.title,
      ),
    ).toBe(true);

<<<<<<< HEAD
    await messenger.request("config/deleteModel", { title: model.title });
    const {
      result: { config: configAfterDelete },
    } = await messenger.request("config/getSerializedProfileInfo", undefined);
=======
    await request("config/deleteModel", { title: model.title });
    const {
      result: { config: configAfterDelete },
    } = await request("config/getSerializedProfileInfo", undefined);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    expect(
      configAfterDelete!.modelsByRole.chat.some(
        (m: ModelDescription) => m.title === model.title,
      ),
    ).toBe(false);
  });

  it("should make an LLM completion", async () => {
    const model: SerializedContinueConfig["models"][number] = {
      title: "Test Model",
      provider: "mock",
      model: "gpt-3.5-turbo",
      underlyingProviderName: "mock",
    };
<<<<<<< HEAD
    await messenger.request("config/addModel", {
      model,
    });

    const resp = await messenger.request("llm/complete", {
=======
    await request("config/addModel", { model });

    const resp = await request("llm/complete", {
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      prompt: "Say 'Hello' and nothing else",
      completionOptions: {},
      title: "Test Model",
    });
    expect(resp).toBe("Test Completion");
  });
});
