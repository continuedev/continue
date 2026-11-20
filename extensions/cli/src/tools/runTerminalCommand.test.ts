import fs from "fs";
import os from "os";
import path from "path";

import { backgroundJobService } from "../services/BackgroundJobService.js";
import { backgroundSignalManager } from "../util/backgroundSignalManager.js";

import {
  isRunningInWsl,
  runCommandInBackground,
  runTerminalCommandTool,
} from "./runTerminalCommand.js";

describe("runTerminalCommandTool", () => {
  const isWindows = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  describe("basic platform-specific terminal execution", () => {
    it("should execute a simple echo command", async () => {
      let command: string;
      let expectedOutput: string;

      if (isWindows) {
        command = 'Write-Output "hello world"';
        expectedOutput = "hello world";
      } else {
        command = 'echo "hello world"';
        expectedOutput = "hello world";
      }

      const result = await runTerminalCommandTool.run({ command });
      expect(result.trim()).toBe(expectedOutput);
    });

    it("should get current directory", async () => {
      let command: string;

      if (isWindows) {
        command = "Get-Location | Select-Object -ExpandProperty Path";
      } else {
        command = "pwd";
      }

      const result = await runTerminalCommandTool.run({ command });

      if (isWindows) {
        // Windows paths like C:\path\to\dir
        expect(result.trim()).toMatch(/^[A-Za-z]:\\.*/);
      } else {
        // Unix paths like /path/to/dir
        expect(result.trim()).toMatch(/^\/.*$/);
      }
    });

    it("should list directory contents", async () => {
      let command: string;

      if (isWindows) {
        command = "Get-ChildItem | Select-Object -ExpandProperty Name";
      } else {
        command = "ls";
      }

      const result = await runTerminalCommandTool.run({ command });
      // Should return some directory content (not empty)
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle command that produces version info", async () => {
      // Node.js should be available on all platforms in CI
      const command = "node --version";
      const result = await runTerminalCommandTool.run({ command });

      // Should contain version number (starts with v)
      expect(result.trim()).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

  describe("basic error handling", () => {
    it("should handle non-existent commands", async () => {
      const command = "definitely-not-a-real-command-xyz123";

      await expect(runTerminalCommandTool.run({ command })).rejects.toMatch(
        /Error \(exit code|Command timed out|not found|not recognized/,
      );
    });
  });

  describe("platform-specific features", () => {
    if (isWindows) {
      it("should work with Windows commands", async () => {
        const result = await runTerminalCommandTool.run({
          command: "Write-Output $env:OS",
        });
        expect(result.trim()).toBe("Windows_NT");
      });
    }

    if (isMac) {
      it("should work with macOS commands", async () => {
        const result = await runTerminalCommandTool.run({
          command: "uname -s",
        });
        expect(result.trim()).toBe("Darwin");
      });
    }

    if (isLinux) {
      it("should work with Linux commands", async () => {
        const result = await runTerminalCommandTool.run({
          command: "uname -s",
        });
        expect(result.trim()).toBe("Linux");
      });
    }
  });

  describe("WSL detection", () => {
    it("should cache the WSL detection result", () => {
      const firstResult = isRunningInWsl();
      const secondResult = isRunningInWsl();
      expect(firstResult).toBe(secondResult);
    });

    if (!isLinux) {
      it("should return false on non-Linux platforms", () => {
        expect(isRunningInWsl()).toBe(false);
      });
    }
  });

  describe("cleanup when the command does not finish", () => {
    const previousTimeout = process.env.TEST_TERMINAL_TIMEOUT;

    afterEach(() => {
      if (previousTimeout === undefined) {
        delete process.env.TEST_TERMINAL_TIMEOUT;
      } else {
        process.env.TEST_TERMINAL_TIMEOUT = previousTimeout;
      }
      backgroundSignalManager.removeAllListeners("backgroundRequested");
      backgroundJobService.killAllJobs();
    });

    it("drops the background listener after an idle timeout", async () => {
      process.env.TEST_TERMINAL_TIMEOUT = "300";
      const before = backgroundSignalManager.listenerCount(
        "backgroundRequested",
      );
      const command =
        process.platform === "win32" ? "Start-Sleep -Seconds 30" : "sleep 30";

      const result = await runTerminalCommandTool.run({ command });

      expect(result).toContain("timed out");
      expect(backgroundSignalManager.listenerCount("backgroundRequested")).toBe(
        before,
      );
    });

    it("stops the command when the background job limit is already full", async () => {
      if (process.platform === "win32") {
        return;
      }

      const marker = path.join(
        os.tmpdir(),
        `cn-bash-cap-${process.pid}-${Date.now()}`,
      );
      process.env.TEST_TERMINAL_TIMEOUT = "20000";
      let pid = 0;
      try {
        for (let i = 0; i < 5; i++) {
          const started = runCommandInBackground("sleep 60");
          expect(started.success).toBe(true);
        }

        const runPromise = runTerminalCommandTool.run({
          command: `sh -c 'echo $$ > ${marker}; exec sleep 60'`,
        });
        await waitForFile(marker, 15000);
        pid = Number(fs.readFileSync(marker, "utf8").trim());

        backgroundSignalManager.signalBackground();
        const result = await runPromise;

        expect(result).toContain("job limit");
        expect(result).not.toContain("continues in foreground");
        await waitUntil(() => !isAlive(pid), 2000);
        expect(isAlive(pid)).toBe(false);
      } finally {
        if (pid && isAlive(pid)) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // already exited
          }
        }
        fs.rmSync(marker, { force: true });
      }
    });
  });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(file: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(file)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${file}`);
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
