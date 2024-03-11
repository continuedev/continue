import * as vscode from "vscode";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import { VsCodeIde } from "../ideProtocol";

export const threadStopped: Map<number, boolean> = new Map();
// Arrays has better perf but you probably won't have thousands of threads in a single debug session

export function registerDebugTracker(
  webviewProtocol: VsCodeWebviewProtocol,
  ide: VsCodeIde
) {
  vscode.debug.registerDebugAdapterTrackerFactory("*", {
    createDebugAdapterTracker(session: vscode.DebugSession) {
      return {
        async onDidSendMessage(message: any) {
          if (message.type == "event") {
            switch (message.event) {
              case "continued":
              case "stopped":
                if (typeof message.body.threadId !== "undefined")
                  threadStopped.set(
                    Number(message.body.threadId),
                    message.event == "stopped"
                  );

                if (message.body.allThreadsStopped)
                  threadStopped.forEach((_, key) =>
                    threadStopped.set(key, true)
                  );

                if (message.body.allThreadsContinued)
                  threadStopped.forEach((_, key) =>
                    threadStopped.set(key, false)
                  );

                webviewProtocol?.request("updateSubmenuItems", {
                  provider: "locals",
                  submenuItems: (await ide.getAvailableThreads()).map(
                    (thread, threadIndex) => {
                      const [threadId, threadName] = thread
                        .split(",")
                        .map((str) => str.trimStart());
                      return {
                        id: `${threadIndex}`,
                        title: threadName,
                        description: threadId,
                      };
                    }
                  ),
                });
                break;

              case "thread":
                if (message.body.reason == "exited")
                  threadStopped.delete(Number(message.body.threadId));
                else if (message.body.reason == "started")
                  threadStopped.set(Number(message.body.threadId), false);
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
