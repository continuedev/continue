import childProcess from "node:child_process";
import util from "node:util";

import { fileURLToPath } from "node:url";
import { ToolImpl } from ".";
import { isProcessBackgrounded, removeBackgroundedProcess } from "../../util/processTerminalBackgroundStates";

const asyncExec = util.promisify(childProcess.exec);

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  // Default to waiting for completion if not specified
  const waitForCompletion = args.waitForCompletion !== false;
  const ideInfo = await extras.ide.getIdeInfo();
  const toolCallId = extras.toolCallId || "";

  if (ideInfo.remoteName === "local" || ideInfo.remoteName === "") {
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

              // Use spawn instead of exec to get streaming output
              const childProc = childProcess.spawn(args.command, {
                cwd,
                shell: true,
              });

              childProc.stdout?.on("data", (data) => {
                // Skip if this process has been backgrounded
                if (isProcessBackgrounded(toolCallId)) return;

                const newOutput = data.toString();
                terminalOutput += newOutput;

                // Send partial output to UI
                if (extras.onPartialOutput) {
                  const status = waitForCompletion ? "" : "Command is running in the background...";
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

              childProc.stderr?.on("data", (data) => {
                // Skip if this process has been backgrounded
                if (isProcessBackgrounded(toolCallId)) return;

                const newOutput = data.toString();
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

              childProc.on("close", (code) => {
                // If this process has been backgrounded, clean it up from the map and return
                if (isProcessBackgrounded(toolCallId)) {
                  removeBackgroundedProcess(toolCallId);
                  return;
                }

                if (!waitForCompletion) {
                  // Already resolved, just update the UI with final output
                  if (extras.onPartialOutput) {
                    const status = (code === 0 || !code
                      ? "\nBackground command completed"
                      : `\nBackground command failed with exit code ${code}`)
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
                } else {
                  // Normal completion, resolve now
                  if (code === 0) {
                    const status = "Command completed";
                    resolve([
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: terminalOutput,
                        status: status
                      },
                    ]);
                  } else {
                    const status = `Command failed with exit code ${code}`;
                    resolve([
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content:
                          terminalOutput,
                          status: status,
                      },
                    ]);
                  }
                }
              });

              childProc.on("error", (error) => {
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

      if (!waitForCompletion) {
        // For non-streaming but also not waiting for completion, use spawn
        // but don't attach any listeners other than error
        try {
          // Use spawn instead of exec but don't wait
          const childProc = childProcess.spawn(args.command, {
            cwd,
            shell: true,
            // Detach the process so it's not tied to the parent
            detached: true,
            // Redirect to /dev/null equivalent (works cross-platform)
            stdio: 'ignore',
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
              status: status
            },
          ];
        }
      } else {
        // Standard execution, waiting for completion
        try {
          const output = await asyncExec(args.command, { cwd });
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
      }
    }
  }

  // For remote environments, just run the command
  // Note: waitForCompletion is not supported in remote environments yet
  await extras.ide.runCommand(args.command);
  return [
    {
      name: "Terminal",
      description: "Terminal command output",
      content:
        "Terminal output not available. This is only available in local development environments and not in SSH environments for example.",
      status: "Command failed",
    },
  ];
}
