import { SerializedContinueConfig } from "core";
// import Mock from "core/llm/llms/Mock.js";
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

// jest.setTimeout(100_000);

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
      `esbuild${exe}`,
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
      messenger = new CoreBinaryMessenger<ToIdeProtocol, FromIdeProtocol>(
        subprocess,
      );
    }

    const testDir = path.join(__dirname, "..", ".test");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    const ide = new FileSystemIde(testDir);
    // const reverseIde = new ReverseMessageIde(messenger.on.bind(messenger), ide);

    // Wait for core to set itself up
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Wait for the subprocess to exit
    if (USE_TCP) {
      (
        messenger as CoreBinaryTcpMessenger<ToIdeProtocol, FromIdeProtocol>
      ).close();
    } else {
      subprocess.kill();
      await new Promise((resolve) => subprocess.on("close", resolve));
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  it("should respond to ping with pong", async () => {
    const resp = await messenger.request("ping", "ping");
    expect(resp).toBe("pong");
  });

  it("should create .continue directory at the specified location with expected files", async () => {
    expect(fs.existsSync(CONTINUE_GLOBAL_DIR)).toBe(true);

    // Many of the files are only created when trying to load the config
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
    const { result } = await messenger.request(
      "config/getSerializedProfileInfo",
      undefined,
    );
    const { config } = result;
    expect(config).toHaveProperty("models");
    expect(config).toHaveProperty("embeddingsProvider");
    expect(config).toHaveProperty("contextProviders");
    expect(config).toHaveProperty("slashCommands");
  });

  it("should properly handle history requests", async () => {
    const sessionId = "test-session-id";
    await messenger.request("history/save", {
      history: [],
      sessionId,
      title: "test-title",

      workspaceDirectory: "test-workspace-directory",
    });
    const sessions = await messenger.request("history/list", {});
    expect(sessions.length).toBeGreaterThan(0);

    const session = await messenger.request("history/load", {
      id: sessionId,
    });
    expect(session).toHaveProperty("history");

    await messenger.request("history/delete", {
      id: sessionId,
    });
    const sessionsAfterDelete = await messenger.request("history/list", {});
    expect(sessionsAfterDelete.length).toBe(sessions.length - 1);
  });

  it("should add and delete a model from config.json", async () => {
    const model: SerializedContinueConfig["models"][number] = {
      title: "Test Model",
      provider: "openai",
      model: "gpt-3.5-turbo",
      underlyingProviderName: "openai",
    };
    await messenger.request("config/addModel", {
      model,
    });
    const {
      result: { config },
    } = await messenger.request("config/getSerializedProfileInfo", undefined);

    expect(config!.modelsByRole.chat.some((m) => m.title === model.title)).toBe(
      true,
    );

    await messenger.request("config/deleteModel", { title: model.title });
    const {
      result: { config: configAfterDelete },
    } = await messenger.request("config/getSerializedProfileInfo", undefined);
    expect(
      configAfterDelete!.modelsByRole.chat.some((m) => m.title === model.title),
    ).toBe(false);
  });

  it("should make an LLM completion", async () => {
    const model: SerializedContinueConfig["models"][number] = {
      title: "Test Model",
      provider: "mock",
      model: "gpt-3.5-turbo",
      underlyingProviderName: "mock",
    };
    await messenger.request("config/addModel", {
      model,
    });

    const resp = await messenger.request("llm/complete", {
      prompt: "Say 'Hello' and nothing else",
      completionOptions: {},
      title: "Test Model",
    });
    expect(resp).toBe("Test Completion");
  });
});
