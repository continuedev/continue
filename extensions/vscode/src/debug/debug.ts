import * as vscode from "vscode";
import { debugPanelWebview } from "../debugPanel";

export const threadStopped: Map<number, boolean> = new Map();
// Arrays has better perf but you probably won't have thousands of threads in a single debug session

export function registerDebugTracker() {
  vscode.debug.registerDebugAdapterTrackerFactory("*", {
    createDebugAdapterTracker(session: vscode.DebugSession) {
      return {
        onDidSendMessage(message: any) {
          console.log(message)
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

                debugPanelWebview?.postMessage({ type: "refreshSubmenuItems" });
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
        }
      };
    },
  });
}
