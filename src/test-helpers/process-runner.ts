import { spawn, type ChildProcess } from "child_process";
import { once } from "events";
import * as path from "path";
import * as os from "os";

export interface ProcessRunOptions {
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  input?: string;
}

export interface ProcessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: Error;
}

/**
 * Cross-platform process runner that handles Windows-specific issues
 * This replaces execaNode for more reliable test execution
 */
export class ProcessRunner {
  private process: ChildProcess | null = null;
  private stdout: string[] = [];
  private stderr: string[] = [];
  private isWindows = os.platform() === "win32";

  async run(
    scriptPath: string,
    options: ProcessRunOptions = {}
  ): Promise<ProcessRunResult> {
    const {
      args = [],
      env = {},
      cwd = process.cwd(),
      timeout = 10000,
      input,
    } = options;

    return new Promise((resolve, reject) => {
      // For Windows, we need to explicitly use node to run the script
      const command = this.isWindows ? process.execPath : process.execPath;
      const processArgs = [scriptPath, ...args];

      // Spawn the process with proper options
      this.process = spawn(command, processArgs, {
        cwd,
        env: {
          ...process.env,
          ...env,
          // Force color output even in non-TTY environments
          FORCE_COLOR: "1",
          // Ensure Node.js doesn't buffer output
          NODE_NO_READLINE: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
        // Windows-specific options
        windowsHide: true,
        shell: false,
      });

      let timeoutId: NodeJS.Timeout | null = null;
      let processExited = false;

      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (!processExited && this.process) {
            this.process.kill("SIGTERM");
            setTimeout(() => {
              if (!processExited && this.process) {
                this.process.kill("SIGKILL");
              }
            }, 1000);
            reject(new Error(`Process timed out after ${timeout}ms`));
          }
        }, timeout);
      }

      // Collect stdout
      this.process.stdout?.on("data", (data) => {
        const str = data.toString();
        this.stdout.push(str);
      });

      // Collect stderr
      this.process.stderr?.on("data", (data) => {
        const str = data.toString();
        this.stderr.push(str);
      });

      // Handle process exit
      this.process.on("exit", (code, signal) => {
        processExited = true;
        if (timeoutId) clearTimeout(timeoutId);

        // Windows needs more time to flush output
        const flushDelay = this.isWindows ? 100 : 10;
        
        // Give streams a chance to flush
        setTimeout(() => {
          resolve({
            stdout: this.stdout.join(""),
            stderr: this.stderr.join(""),
            exitCode: code ?? (signal ? 1 : 0),
          });
        }, flushDelay);
      });

      // Handle process errors
      this.process.on("error", (error) => {
        processExited = true;
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });

      // Send input if provided
      if (input && this.process.stdin) {
        this.process.stdin.write(input);
        this.process.stdin.end();
      }
    });
  }

  /**
   * Forcefully kill the process if it's still running
   */
  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGKILL");
    }
  }
}

/**
 * Helper function to run a Node.js script with proper Windows handling
 */
export async function runNodeScript(
  scriptPath: string,
  options: ProcessRunOptions = {}
): Promise<ProcessRunResult> {
  const runner = new ProcessRunner();
  try {
    return await runner.run(scriptPath, options);
  } finally {
    runner.kill(); // Ensure cleanup
  }
}