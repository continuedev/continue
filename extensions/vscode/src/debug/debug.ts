import * as vscode from "vscode";

import type { VsCodeIde } from "../VsCodeIde";
import type { VsCodeWebviewProtocol } from "../webviewProtocol";

export const threadStopped: Map<number, boolean> = new Map();
// Arrays has better perf but you probably won't have thousands of threads in a single debug session

export function registerDebugTracker(
  webviewProtocol: VsCodeWebviewProtocol,
  ide: VsCodeIde,
) {
  vscode.debug.registerDebugAdapterTrackerFactory("*", {
    createDebugAdapterTracker(_session: vscode.DebugSession) {
      const updateThreads = async () => {
        webviewProtocol?.request("refreshSubmenuItems", {
          providers: ["debugger"],
        });
      };

      return {
        async onWillStopSession() {
          threadStopped.clear();
          updateThreads();
        },
        async onDidSendMessage(message: any) {
          if (message.type === "event") {
            switch (message.event) {
              case "continued":
              case "stopped":
                if (typeof message.body.threadId !== "undefined") {
                  threadStopped.set(
                    Number(message.body.threadId),
                    message.event === "stopped",
                  );
                }

                if (message.body.allThreadsStopped) {
                  threadStopped.forEach((_, key) =>
                    threadStopped.set(key, true),
                  );
                }

                if (message.body.allThreadsContinued) {
                  threadStopped.forEach((_, key) =>
                    threadStopped.set(key, false),
                  );
                }

                updateThreads();
                break;

              case "thread":
                if (message.body.reason === "exited") {
                  threadStopped.delete(Number(message.body.threadId));
                } else if (message.body.reason === "started") {
                  threadStopped.set(Number(message.body.threadId), false);
                }
                // somehow the threadId does not respect the specification in my vscodium (debugging C++)
                // expecting a number but got a string instead
                break;

              default:
                break;
            }
          }
        },
      };
    },
  });
}
