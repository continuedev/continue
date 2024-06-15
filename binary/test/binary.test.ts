import { FromIdeProtocol, ToIdeProtocol } from "core/protocol/index.js";
import FileSystemIde from "core/util/filesystem";
import { ReverseMessageIde } from "core/util/reverseMessageIde";
import fs from "fs";
import { spawn } from "node:child_process";
import path from "path";
import { CoreBinaryMessenger } from "../src/IpcMessenger";

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

describe("Test Suite", () => {
  it("should pass", async () => {
    const [platform, arch] = autodetectPlatformAndArch();
    const binaryPath = path.join(
      __dirname,
      "..",
      "bin",
      `${platform}-${arch}`,
      `continue-binary${platform === "win32" ? ".exe" : ""}`,
    );
    expect(fs.existsSync(binaryPath)).toBe(true);
    const subprocess = spawn(binaryPath);
    const messenger = new CoreBinaryMessenger<ToIdeProtocol, FromIdeProtocol>(
      subprocess,
    );
    const ide = new FileSystemIde();
    const reverseIde = new ReverseMessageIde(messenger.on.bind(messenger), ide);

    // Wait 3 seconds and then close the subprocess
    await new Promise((resolve) =>
      setTimeout(() => {
        subprocess.kill();
        resolve(null);
      }, 3000),
    );
    // Wait for the subprocess to exit
    await new Promise((resolve) => subprocess.on("close", resolve));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });
});
