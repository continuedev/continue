import { ChildProcess, spawn } from "child_process";
import fs from "fs";

import {
  evaluateTerminalCommandSecurity,
  type ToolPolicy,
} from "@continuedev/terminal-security";

import { backgroundJobService } from "../services/BackgroundJobService.js";
import { services } from "../services/index.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import {
  isGitCommitCommand,
  isPullRequestCommand,
} from "../telemetry/utils.js";
import { backgroundSignalManager } from "../util/backgroundSignalManager.js";
import { emitBashToolEnded, emitBashToolStarted } from "../util/cli.js";
import { parseEnvNumber } from "../util/truncateOutput.js";

import { Tool, ToolRunContext } from "./types.js";

// Output truncation defaults
const DEFAULT_BASH_MAX_OUTPUT_BYTES = 50000; // ~12.5k tokens
const DEFAULT_BASH_MAX_LINES = 1000;
const TERMINAL_OUTPUT_TRUNCATION_MARKER =
  "[Continue CLI: terminal_output_truncated";

/**
 * When running on Windows, but inside WSL, shell commands need to run using the WSL environment.
 */
export function isRunningInWsl(): boolean {
  // WSL only applies when platform reports as Linux
  if (process.platform !== "linux") {
    return false;
  }

  if (process.env.WSL_DISTRO_NAME) {
    return true;
  }

  // Check /proc/version for Microsoft/WSL indicators
  try {
    const procVersion = fs.readFileSync("/proc/version", "utf8").toLowerCase();
    return procVersion.includes("microsoft") || procVersion.includes("wsl");
  } catch {
    return false;
  }
}

function getBashMaxOutputBytes(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_BYTES,
    parseEnvNumber(
      process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_CHARS,
      DEFAULT_BASH_MAX_OUTPUT_BYTES,
    ),
  );
}

function getBashMaxLines(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_LINES,
    DEFAULT_BASH_MAX_LINES,
  );
}

interface TerminalOutputLimits {
  maxBytes: number;
  maxLines: number;
}

interface TerminalOutputLimitResult {
  output: string;
  wasTruncated: boolean;
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function takeUtf8Prefix(text: string, maxBytes: number): string {
  if (maxBytes <= 0) {
    return "";
  }

  let bytes = 0;
  let result = "";

  for (const char of text) {
    const charBytes = byteLength(char);
    if (bytes + charBytes > maxBytes) {
      break;
    }

    result += char;
    bytes += charBytes;
  }

  return result;
}

function takeUtf8Suffix(text: string, maxBytes: number): string {
  if (maxBytes <= 0) {
    return "";
  }

  const chars = Array.from(text);
  let bytes = 0;
  let startIndex = chars.length;

  for (let i = chars.length - 1; i >= 0; i--) {
    const charBytes = byteLength(chars[i]);
    if (bytes + charBytes > maxBytes) {
      break;
    }

    bytes += charBytes;
    startIndex = i;
  }

  return chars.slice(startIndex).join("");
}

function buildByteTruncationMarker(
  omittedBytes: number,
  originalBytes: number,
  maxBytes: number,
): string {
  return `\n\n${TERMINAL_OUTPUT_TRUNCATION_MARKER} omitted_bytes=${omittedBytes} original_bytes=${originalBytes} max_bytes=${maxBytes}; ${omittedBytes} bytes dropped]\n\n`;
}

function buildLineTruncationMarker(
  omittedLines: number,
  maxLines: number,
): string {
  return `${TERMINAL_OUTPUT_TRUNCATION_MARKER} omitted_lines=${omittedLines} max_lines=${maxLines}; ${omittedLines} lines dropped]`;
}

function truncateLinesHeadTail(
  output: string,
  maxLines: number,
): TerminalOutputLimitResult {
  if (!output) {
    return { output, wasTruncated: false };
  }

  const lines = output.split("\n");
  if (lines.length <= maxLines) {
    return { output, wasTruncated: false };
  }

  const headLineCount = Math.ceil(maxLines / 2);
  const tailLineCount = Math.floor(maxLines / 2);
  const omittedLines = lines.length - headLineCount - tailLineCount;
  const head = lines.slice(0, headLineCount).join("\n");
  const tail = tailLineCount > 0 ? lines.slice(-tailLineCount).join("\n") : "";
  const marker = buildLineTruncationMarker(omittedLines, maxLines);

  return {
    output: tail ? `${head}\n${marker}\n${tail}` : `${head}\n${marker}`,
    wasTruncated: true,
  };
}

function truncateBytesHeadTail(
  output: string,
  maxBytes: number,
): TerminalOutputLimitResult {
  const originalBytes = byteLength(output);
  if (originalBytes <= maxBytes) {
    return { output, wasTruncated: false };
  }

  let omittedBytes = originalBytes;
  let truncatedOutput = "";

  // The omitted byte count appears inside the marker, so marker length can
  // change as the kept head/tail budgets settle.
  for (let i = 0; i < 5; i++) {
    const marker = buildByteTruncationMarker(
      omittedBytes,
      originalBytes,
      maxBytes,
    );
    const availableBytes = maxBytes - byteLength(marker);

    if (availableBytes <= 0) {
      return {
        output: takeUtf8Prefix(marker, maxBytes),
        wasTruncated: true,
      };
    }

    const headBudget = Math.ceil(availableBytes / 2);
    const tailBudget = Math.floor(availableBytes / 2);
    const head = takeUtf8Prefix(output, headBudget);
    const tail = takeUtf8Suffix(output, tailBudget);
    const nextOmittedBytes =
      originalBytes - byteLength(head) - byteLength(tail);

    truncatedOutput = `${head}${marker}${tail}`;
    if (nextOmittedBytes === omittedBytes) {
      break;
    }
    omittedBytes = nextOmittedBytes;
  }

  return {
    output: takeUtf8Prefix(truncatedOutput, maxBytes),
    wasTruncated: true,
  };
}

function limitTerminalOutput(
  output: string,
  limits: TerminalOutputLimits,
): TerminalOutputLimitResult {
  const lineResult = truncateLinesHeadTail(output, limits.maxLines);
  const byteResult = truncateBytesHeadTail(lineResult.output, limits.maxBytes);

  return {
    output: byteResult.output,
    wasTruncated: lineResult.wasTruncated || byteResult.wasTruncated,
  };
}

// Helper function to use login shell on Unix/macOS and PowerShell on Windows and available shell in WSL
function getShellCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    // Windows: Use PowerShell
    return {
      shell: "powershell.exe",
      args: ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command],
    };
  }

  if (isRunningInWsl()) {
    // in WSL, bash is always available
    const wslShell = process.env.SHELL || "/bin/bash";
    return {
      shell: wslShell,
      args: ["-l", "-c", command],
    };
  }

  // Unix/macOS: Use login shell to source .bashrc/.zshrc etc.
  const userShell = process.env.SHELL || "/bin/bash";
  return { shell: userShell, args: ["-l", "-c", command] };
}

export function runCommandInBackground(command: string): {
  success: boolean;
  jobId?: string;
  error?: string;
} {
  const job = backgroundJobService.createJob(command);
  if (!job) {
    return {
      success: false,
      error: "Cannot create background job: limit of 5 concurrent jobs reached",
    };
  }

  const { shell, args } = getShellCommand(command);
  const child = backgroundJobService.startJob(job.id, shell, args);

  if (!child) {
    return {
      success: false,
      error: `Failed to start background job ${job.id}`,
    };
  }

  return {
    success: true,
    jobId: job.id,
  };
}

export const runTerminalCommandTool: Tool = {
  name: "Bash",
  displayName: "Bash",
  description: `Executes a terminal command and returns the output

Commands are automatically executed from the current working directory (${process.cwd()}), so there's no need to change directories with 'cd' commands.

IMPORTANT: To edit files, use Edit/MultiEdit tools instead of bash commands (sed, awk, etc).
`,
  parameters: {
    type: "object",
    required: ["command"],
    properties: {
      command: {
        type: "string",
        description: "The command to execute in the terminal.",
      },
      timeout: {
        type: "number",
        description:
          "Optional timeout in seconds (max 600). Use this parameter for commands that take longer than the default 180 second timeout.",
      },
    },
  },
  readonly: false,
  isBuiltIn: true,
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    parsedArgs: Record<string, unknown>,
  ): ToolPolicy => {
    return evaluateTerminalCommandSecurity(
      basePolicy,
      parsedArgs.command as string,
    );
  },
  preprocess: async (args) => {
    const command = args.command;
    if (!command || typeof command !== "string") {
      throw new Error("command arg is required and must be a non-empty string");
    }
    const truncatedCmd =
      command.length > 60 ? command.substring(0, 60) + "..." : command;
    return {
      args,
      preview: [
        {
          type: "text",
          content: `Will run: ${truncatedCmd}`,
        },
      ],
    };
  },
  run: async (
    {
      command,
      timeout,
    }: {
      command: string;
      timeout?: number;
    },
    context?: ToolRunContext,
  ): Promise<string> => {
    // Divide limits by parallel tool call count to avoid context overflow
    const parallelCount = context?.parallelToolCallCount ?? 1;
    const baseMaxBytes = getBashMaxOutputBytes();
    const baseMaxLines = getBashMaxLines();
    const maxBytes = Math.max(1, Math.floor(baseMaxBytes / parallelCount));
    const maxLines = Math.max(1, Math.floor(baseMaxLines / parallelCount));

    emitBashToolStarted();

    const terminalOutput: string = await new Promise((resolve, reject) => {
      // Use same shell logic as core implementation
      const { shell, args } = getShellCommand(command);
      const child = spawn(shell, args);
      let stdout = "";
      let stderr = "";
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;

      // Determine timeout: use provided timeout (capped at 600s), test env variable, or default 120s
      let TIMEOUT_MS = 180000; // 180 seconds default
      if (timeout !== undefined) {
        // Cap at 600 seconds (10 minutes)
        const cappedTimeout = Math.min(timeout, 600);
        TIMEOUT_MS = cappedTimeout * 1000;
      } else if (
        process.env.NODE_ENV === "test" &&
        process.env.TEST_TERMINAL_TIMEOUT
      ) {
        TIMEOUT_MS = parseInt(process.env.TEST_TERMINAL_TIMEOUT, 10);
      }

      /**
       * Applies the terminal output budget to the complete payload returned to
       * chat history or the model loop.
       */
      const formatTerminalResult = (output: string): string => {
        let result = output;
        const limitResult = limitTerminalOutput(result, {
          maxBytes,
          maxLines,
        });
        result = limitResult.output;

        if (limitResult.wasTruncated && parallelCount > 1) {
          result +=
            `\n\n(Note: output limit reduced due to ${parallelCount} parallel tool calls. ` +
            `Single-tool limit: ${baseMaxBytes.toLocaleString()} bytes or ${baseMaxLines.toLocaleString()} lines.)`;
        }

        return limitTerminalOutput(result, {
          maxBytes,
          maxLines,
        }).output;
      };

      const moveToBackground = () => {
        if (isResolved) return;
        isResolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        backgroundSignalManager.off("backgroundRequested", moveToBackground);

        // Detach stdout/stderr listeners so they don't accumulate in local
        // buffers or trigger chat history updates after the tool call resolves.
        // BackgroundJobService.createJobWithProcess attaches its own listeners.
        child.stdout.removeListener("data", onStdout);
        child.stderr.removeListener("data", onStderr);

        const job = backgroundJobService.createJobWithProcess(
          command,
          child as ChildProcess,
          stdout,
        );

        if (job) {
          resolve(
            formatTerminalResult(
              `Command moved to background. Job ID: ${job.id}\nOutput so far:\n${stdout}\nUse CheckBackgroundJob("${job.id}") to check status.`,
            ),
          );
        } else {
          resolve(
            formatTerminalResult(
              `Failed to move to background (job limit reached). Command continues in foreground.\nOutput so far: ${stdout}`,
            ),
          );
        }
      };

      backgroundSignalManager.on("backgroundRequested", moveToBackground);

      const resetTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          child.kill();
          let output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
          output += `\n\n[Command timed out after ${TIMEOUT_MS / 1000} seconds of no output]`;

          resolve(formatTerminalResult(output));
        }, TIMEOUT_MS);
      };

      const showCurrentOutput = () => {
        if (!context?.toolCallId) return;
        try {
          const currentOutput = stdout + (stderr ? `\nStderr: ${stderr}` : "");
          services.chatHistory.addToolResult(
            context.toolCallId,
            formatTerminalResult(currentOutput),
            "calling",
          );
        } catch {
          // Ignore errors during streaming updates
        }
      };

      // Start the initial timeout
      resetTimeout();

      const onStdout = (data: Buffer) => {
        stdout += data.toString();
        resetTimeout();
        showCurrentOutput();
      };

      const onStderr = (data: Buffer) => {
        stderr += data.toString();
        resetTimeout();
        showCurrentOutput();
      };

      child.stdout.on("data", onStdout);
      child.stderr.on("data", onStderr);

      child.on("close", (code) => {
        if (isResolved) return;
        isResolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        backgroundSignalManager.removeListener(
          "backgroundRequested",
          moveToBackground,
        );

        // Only reject on non-zero exit code if there's also stderr
        if (code !== 0 && stderr) {
          reject(formatTerminalResult(`Error (exit code ${code}): ${stderr}`));
          return;
        }

        // Track specific git operations only after successful execution
        if (code === 0) {
          if (isGitCommitCommand(command)) {
            telemetryService.recordCommitCreated();
          } else if (isPullRequestCommand(command)) {
            telemetryService.recordPullRequestCreated();
          }
        }

        let output = stdout;
        if (stderr) {
          output = stdout + `\nStderr: ${stderr}`;
        }

        resolve(formatTerminalResult(output));
      });

      child.on("error", (error) => {
        if (isResolved) return;
        isResolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        backgroundSignalManager.off("backgroundRequested", moveToBackground);
        reject(`Error: ${error.message}`);
      });
    });

    emitBashToolEnded();

    return terminalOutput;
  },
};
