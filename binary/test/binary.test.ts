import { FromIdeProtocol, ToIdeProtocol } from "core/protocol/index.js";
import FileSystemIde from "core/util/filesystem";
import { IMessenger } from "core/util/messenger";
import { ReverseMessageIde } from "core/util/reverseMessageIde";
import fs from "fs";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
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

describe("Test Suite", () => {
  let messenger: IMessenger<ToIdeProtocol, FromIdeProtocol>;
  let subprocess: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    const [platform, arch] = autodetectPlatformAndArch();
    const binaryPath = path.join(
      __dirname,
      "..",
      "bin",
      `${platform}-${arch}`,
      `continue-binary${platform === "win32" ? ".exe" : ""}`,
    );
    expect(fs.existsSync(binaryPath)).toBe(true);

    if (USE_TCP) {
      messenger = new CoreBinaryTcpMessenger<ToIdeProtocol, FromIdeProtocol>();
    } else {
      subprocess = spawn(binaryPath, {
        env: { ...process.env, CONTINUE_GLOBAL_DIR },
      });
      messenger = new CoreBinaryMessenger<ToIdeProtocol, FromIdeProtocol>(
        subprocess,
      );
    }

    const testDir = path.join(__dirname, "..", ".test");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    const ide = new FileSystemIde(testDir);
    const reverseIde = new ReverseMessageIde(messenger.on.bind(messenger), ide);

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
      "config/getBrowserSerialized",
      undefined,
    );

    const expectedFiles = [
      "config.json",
      "config.ts",
      "package.json",
      "logs/core.log",
      "index/autocompleteCache.sqlite",
      "out/config.js",
      "types/core/index.d.ts",
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(CONTINUE_GLOBAL_DIR, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it("should properly edit config", async () => {
    const config = await messenger.request(
      "config/getBrowserSerialized",
      undefined,
    );
    expect(config).toHaveProperty("models");
    expect(config).toHaveProperty("embeddingsProvider");
    expect(config).toHaveProperty("contextProviders");
    expect(config).toHaveProperty("slashCommands");
  });
});
