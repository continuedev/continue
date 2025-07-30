import { decode } from "iconv-lite";
import { execSync, exec, spawn } from "node:child_process";

// Decode buffer output using the detected system encoding
function getDecodedOutput(data: Buffer): string {
  if (process.platform === "win32") {
    const { encoding } = detectSystemEncoding();

    try {
      return decode(data, encoding);
    } catch {
      // Fallback: try the other common encoding
      const fallbackEncoding = encoding === "utf-8" ? "gbk" : "utf-8";
      try {
        return decode(data, fallbackEncoding);
      } catch {
        // Final fallback: use Node's default
        return data.toString();
      }
    }
  } else {
    return data.toString();
  }
}

// Check if PowerShell Core is available (cached result)
let hasPwsh: boolean | null = null;
let systemEncoding: string | null = null;
let shouldForceUtf8: boolean | null = null;

function checkPwshAvailability(): boolean {
  if (hasPwsh === null) {
    try {
      // Check if pwsh exists by trying to access it
      execSync("pwsh -Version", { stdio: "ignore" });
      hasPwsh = true;
    } catch {
      hasPwsh = false;
    }
  }
  return hasPwsh;
}

function detectSystemEncoding(): { encoding: string; forceUtf8: boolean } {
  if (systemEncoding !== null && shouldForceUtf8 !== null) {
    return { encoding: systemEncoding, forceUtf8: shouldForceUtf8 };
  }

  if (process.platform !== "win32") {
    systemEncoding = "utf-8";
    shouldForceUtf8 = false;
    return { encoding: systemEncoding, forceUtf8: shouldForceUtf8 };
  }

  try {
    // Get current code page
    const chcpOutput = execSync("chcp", { encoding: "ascii" }).toString();
    const codePageMatch = chcpOutput.match(/(\d+)/);
    const currentCodePage = codePageMatch ? codePageMatch[1] : "936"; // default to GBK

    // Check if we're in a Chinese locale
    const isChineseLocale =
      process.env.LANG?.includes("zh") ||
      process.env.LC_ALL?.includes("zh") ||
      currentCodePage === "936"; // GBK code page

    // Check Windows version (Windows 10+ has better UTF-8 support)
    const isModernWindows =
      process.platform === "win32" &&
      parseInt(process.version.split(".")[0].substring(1)) >= 10;

    // Force UTF-8 in modern scenarios
    const hasPowerShellCore = checkPwshAvailability();
    const shouldForce = isModernWindows || hasPowerShellCore;

    if (shouldForce) {
      // Modern Windows or PowerShell Core - prefer UTF-8
      systemEncoding = "utf-8";
      shouldForceUtf8 = true;
    } else if (isChineseLocale) {
      // Legacy Windows with Chinese locale - use GBK
      systemEncoding = "gbk";
      shouldForceUtf8 = false;
    } else {
      // Legacy Windows, non-Chinese - try UTF-8 but don't force
      systemEncoding = currentCodePage === "65001" ? "utf-8" : "gbk";
      shouldForceUtf8 = false;
    }
  } catch {
    // Final fallback - prefer UTF-8 for better emoji support
    // Most systems today can handle UTF-8 better than GBK
    systemEncoding = "utf-8";
    shouldForceUtf8 = false; // Don't force, but try UTF-8 first
  }

  return { encoding: systemEncoding, forceUtf8: shouldForceUtf8 };
}

function getShellCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    const shell = checkPwshAvailability() ? "pwsh" : "powershell.exe";
    const { forceUtf8 } = detectSystemEncoding();

    let enhancedCommand = command;

    if (forceUtf8) {
      // Force UTF-8 for modern systems, PowerShell Core, or when explicitly needed
      enhancedCommand = `chcp 65001 >$null 2>&1; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;
    } else {
      // Use system defaults for legacy systems or Chinese locales
      // Just ensure console output encoding matches the expected encoding
      enhancedCommand = `[Console]::OutputEncoding = [Console]::InputEncoding; ${command}`;
    }

    return {
      shell,
      args: [
        "-NoLogo",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        enhancedCommand,
      ],
    };
  } else {
    // Unix/macOS: Use login shell to source .bashrc/.zshrc etc.
    const userShell = process.env.SHELL || "/bin/bash";
    return { shell: userShell, args: ["-l", "-c", command] };
  }
}

import { fileURLToPath } from "node:url";
import { ToolImpl } from ".";
import {
  isProcessBackgrounded,
  removeBackgroundedProcess,
} from "../../util/processTerminalBackgroundStates";
import { getBooleanArg, getStringArg } from "../parseArgs";

// Add color-supporting environment variables with platform-specific optimizations
const getColorEnv = () => {
  const baseEnv = { ...process.env };

  if (process.platform === "win32") {
    const { encoding, forceUtf8 } = detectSystemEncoding();

    const windowsEnv = {
      ...baseEnv,
      // Enable ANSI color sequences in Windows Console/PowerShell
      FORCE_COLOR: "1",
      // Some Node.js tools and npm packages respect this
      NO_COLOR: undefined, // Remove NO_COLOR if it exists
      // Enable virtual terminal processing for better ANSI support
      ENABLE_VIRTUAL_TERMINAL_PROCESSING: "1",
      // PowerShell Core specific
      PSStyle: "1",
    };

    if (forceUtf8) {
      // Set UTF-8 environment for modern systems
      return {
        ...windowsEnv,
        PYTHONIOENCODING: "utf-8",
        CHCP: "65001",
        LC_ALL: "C.UTF-8",
        LANG: "C.UTF-8",
      };
    } else {
      // Use system defaults for legacy/Chinese systems
      return {
        ...windowsEnv,
        // Let system encoding be respected
        PYTHONIOENCODING: encoding === "utf-8" ? "utf-8" : "gbk",
      };
    }
  } else {
    // Unix/Linux/macOS specific color environment
    return {
      ...baseEnv,
      FORCE_COLOR: "1",
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
      CLICOLOR: "1",
      CLICOLOR_FORCE: "1",
      NO_COLOR: undefined, // Remove NO_COLOR if it exists
    };
  }
};

const ENABLED_FOR_REMOTES = [
  "",
  "local",
  "wsl",
  "dev-container",
  "devcontainer",
  "ssh-remote",
  "attached-container",
  "codespaces",
  "tunnel",
];

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  const command = getStringArg(args, "command");
  // Default to waiting for completion if not specified
  const waitForCompletion =
    getBooleanArg(args, "waitForCompletion", false) ?? true;

  const ideInfo = await extras.ide.getIdeInfo();
  const toolCallId = extras.toolCallId || "";

  if (ENABLED_FOR_REMOTES.includes(ideInfo.remoteName)) {
    // For streaming output
    if (extras.onPartialOutput) {
      return new Promise((resolve, reject) => {
        try {
          const getWorkspaceDirsPromise = extras.ide.getWorkspaceDirs();
          getWorkspaceDirsPromise
            .then((workspaceDirs) => {
              const cwd = fileURLToPath(workspaceDirs[0]);
              let terminalOutput = "";

              if (!waitForCompletion) {
                const status = "Command is running in the background...";
                if (extras.onPartialOutput) {
                  extras.onPartialOutput({
                    toolCallId,
                    contextItems: [
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: "",
                        status: status,
                      },
                    ],
                  });
                }
              }

              // Use spawn with color environment
              const { shell, args } = getShellCommand(command);
              const childProc = spawn(shell, args, {
                cwd,
                env: getColorEnv(), // Add enhanced environment for colors
              });
              childProc.stdout?.on("data", (data: Buffer) => {
                // Skip if this process has been backgrounded
                if (isProcessBackgrounded(toolCallId)) return;

                const newOutput = getDecodedOutput(data);
                terminalOutput += newOutput;

                // Send partial output to UI
                if (extras.onPartialOutput) {
                  const status = waitForCompletion
                    ? ""
                    : "Command is running in the background...";
                  extras.onPartialOutput({
                    toolCallId,
                    contextItems: [
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: terminalOutput,
                        status: status,
                      },
                    ],
                  });
                }
              });

              childProc.stderr?.on("data", (data: Buffer) => {
                // Skip if this process has been backgrounded
                if (isProcessBackgrounded(toolCallId)) return;

                const newOutput = getDecodedOutput(data);
                terminalOutput += newOutput;

                // Send partial output to UI, status is not required
                if (extras.onPartialOutput) {
                  extras.onPartialOutput({
                    toolCallId,
                    contextItems: [
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: terminalOutput,
                      },
                    ],
                  });
                }
              });

              // If we don't need to wait for completion, resolve immediately
              if (!waitForCompletion) {
                const status = "Command is running in the background...";
                resolve([
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                    status: status,
                  },
                ]);
              }
              childProc.on("close", (code: number | null) => {
                // If this process has been backgrounded, clean it up from the map and return
                if (isProcessBackgrounded(toolCallId)) {
                  removeBackgroundedProcess(toolCallId);
                  return;
                }

                if (waitForCompletion) {
                  // Normal completion, resolve now
                  if (code === 0) {
                    const status = "Command completed";
                    resolve([
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: terminalOutput,
                        status: status,
                      },
                    ]);
                  } else {
                    const status = `Command failed with exit code ${code}`;
                    resolve([
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: terminalOutput,
                        status: status,
                      },
                    ]);
                  }
                } else {
                  // Already resolved, just update the UI with final output
                  if (extras.onPartialOutput) {
                    const status =
                      code === 0 || !code
                        ? "\nBackground command completed"
                        : `\nBackground command failed with exit code ${code}`;
                    extras.onPartialOutput({
                      toolCallId,
                      contextItems: [
                        {
                          name: "Terminal",
                          description: "Terminal command output",
                          content: terminalOutput,
                          status: status,
                        },
                      ],
                    });
                  }
                }
              });

              childProc.on("error", (error: Error) => {
                // If this process has been backgrounded, clean it up from the map and return
                if (isProcessBackgrounded(toolCallId)) {
                  removeBackgroundedProcess(toolCallId);
                  return;
                }

                reject(error);
              });
            })
            .catch((error) => {
              reject(error);
            });
        } catch (error: any) {
          reject(error);
        }
      });
    } else {
      // Fallback to non-streaming for older clients
      const workspaceDirs = await extras.ide.getWorkspaceDirs();
      const cwd = fileURLToPath(workspaceDirs[0]);

      if (waitForCompletion) {
        // Standard execution, waiting for completion
        try {
          // Use spawn approach for consistency with streaming version
          const { shell: nonStreamingShell, args: nonStreamingArgs } =
            getShellCommand(command);
          const output = await new Promise<{ stdout: string; stderr: string }>(
            (resolve, reject) => {
              const childProc = spawn(nonStreamingShell, nonStreamingArgs, {
                cwd,
                env: getColorEnv(),
              });

              let stdout = "";
              let stderr = "";
              childProc.stdout?.on("data", (data: Buffer) => {
                stdout += getDecodedOutput(data);
              });

              childProc.stderr?.on("data", (data: Buffer) => {
                stderr += getDecodedOutput(data);
              });

              childProc.on("close", (code: number | null) => {
                if (code === 0) {
                  resolve({ stdout, stderr });
                } else {
                  const error = new Error(
                    `Command failed with exit code ${code}`,
                  );
                  (error as any).stderr = stderr;
                  reject(error);
                }
              });

              childProc.on("error", (error: Error) => {
                reject(error);
              });
            },
          );

          const status = "Command completed";
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: output.stdout ?? "",
              status: status,
            },
          ];
        } catch (error: any) {
          const status = `Command failed with: ${error.message || error.toString()}`;
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: error.stderr ?? error.toString(),
              status: status,
            },
          ];
        }
      } else {
        // For non-streaming but also not waiting for completion, use spawn
        // but don't attach any listeners other than error
        try {
          // Use spawn with color environment
          const { shell: detachedShell, args: detachedArgs } =
            getShellCommand(command);
          const childProc = spawn(detachedShell, detachedArgs, {
            cwd,
            env: getColorEnv(), // Add color environment
            // Detach the process so it's not tied to the parent
            detached: true,
            // Redirect to /dev/null equivalent (works cross-platform)
            stdio: "ignore",
          });

          // Even for detached processes, add event handlers to clean up the background process map
          childProc.on("close", () => {
            if (isProcessBackgrounded(toolCallId)) {
              removeBackgroundedProcess(toolCallId);
            }
          });

          childProc.on("error", () => {
            if (isProcessBackgrounded(toolCallId)) {
              removeBackgroundedProcess(toolCallId);
            }
          });

          // Unref the child to allow the Node.js process to exit
          childProc.unref();
          const status = "Command is running in the background...";
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: status,
              status: status,
            },
          ];
        } catch (error: any) {
          const status = `Command failed with: ${error.message || error.toString()}`;
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: status,
              status: status,
            },
          ];
        }
      }
    }
  }

  // For remote environments, just run the command
  // Note: waitForCompletion is not supported in remote environments yet
  await extras.ide.runCommand(command);
  return [
    {
      name: "Terminal",
      description: "Terminal command output",
      content:
        "Terminal output not available. This is only available in local development environments and not in SSH environments for example.",
      status: "Command failed",
    },
  ];
};
