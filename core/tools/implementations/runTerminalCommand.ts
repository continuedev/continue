import childProcess from "node:child_process";
import util from "node:util";

import { fileURLToPath } from "node:url";
import { ToolImpl } from ".";

const asyncExec = util.promisify(childProcess.exec);

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
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
              let stdout = "";
              let stderr = "";

              // Use spawn instead of exec to get streaming output
              const childProc = childProcess.spawn(args.command, {
                cwd,
                shell: true,
              });

              childProc.stdout?.on("data", (data) => {
                const newOutput = data.toString();
                stdout += newOutput;

                // Send partial output to UI
                if (extras.onPartialOutput) {
                  extras.onPartialOutput({
                    toolCallId,
                    contextItems: [
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: stdout,
                      },
                    ],
                  });
                }
              });

              childProc.stderr?.on("data", (data) => {
                const newOutput = data.toString();
                stderr += newOutput;

                // Send partial output to UI
                if (extras.onPartialOutput) {
                  extras.onPartialOutput({
                    toolCallId,
                    contextItems: [
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: stderr,
                      },
                    ],
                  });
                }
              });

              childProc.on("close", (code) => {
                if (code === 0) {
                  resolve([
                    {
                      name: "Terminal",
                      description: "Terminal command output",
                      content: stdout || "[Command completed with no output]",
                    },
                  ]);
                } else {
                  resolve([
                    {
                      name: "Terminal",
                      description: "Terminal command output",
                      content:
                        stderr ||
                        stdout ||
                        `[Command failed with exit code ${code}]`,
                    },
                  ]);
                }
              });

              childProc.on("error", (error) => {
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
      try {
        const workspaceDirs = await extras.ide.getWorkspaceDirs();
        const output = await asyncExec(args.command, {
          cwd: fileURLToPath(workspaceDirs[0]),
        });
        return [
          {
            name: "Terminal",
            description: "Terminal command output",
            content: output.stdout ?? "",
          },
        ];
      } catch (error: any) {
        return [
          {
            name: "Terminal",
            description: "Terminal command output",
            content: error.stderr ?? error.toString(),
          },
        ];
      }
    }
  }

  await extras.ide.runCommand(args.command);
  return [
    {
      name: "Terminal",
      description: "Terminal command output",
      content:
        "[Terminal output not available. This is only available in local development environments and not in SSH environments for example.]",
    },
  ];
};
