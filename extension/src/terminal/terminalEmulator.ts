// /* Terminal emulator - commented because node-pty is causing problems. */

// import * as vscode from "vscode";
// import pty = require("node-pty");
// import os = require("os");
// import { extensionContext } from "../activation/activate";
// import { debugPanelWebview } from "../debugPanel"; // Need to consider having multiple panels, where to store this state.
// import {
//   CommandCaptureSnooper,
//   PythonTracebackSnooper,
//   TerminalSnooper,
// } from "./snoopers";

// export function tracebackToWebviewAction(traceback: string) {
//   if (debugPanelWebview) {
//     debugPanelWebview.postMessage({
//       type: "traceback",
//       value: traceback,
//     });
//   } else {
//     vscode.commands
//       .executeCommand("continue.openContinueGUI", extensionContext)
//       .then(() => {
//         // TODO: Waiting for the webview to load, but should add a hook to the onLoad message event. Same thing in autodebugTest command in commands.ts
//         setTimeout(() => {
//           debugPanelWebview?.postMessage({
//             type: "traceback",
//             value: traceback,
//           });
//         }, 500);
//       });
//   }
// }

// const DEFAULT_SNOOPERS = [
//   new PythonTracebackSnooper(tracebackToWebviewAction),
//   new CommandCaptureSnooper((data: string) => {
//     if (data.trim().startsWith("pytest ")) {
//       let fileAndFunctionSpecifier = data.split(" ")[1];
//       vscode.commands.executeCommand(
//         "continue.debugTest",
//         fileAndFunctionSpecifier
//       );
//     }
//   }),
// ];

// // Whenever a user opens a terminal, replace it with ours
// vscode.window.onDidOpenTerminal((terminal) => {
//   if (terminal.name != "Continue") {
//     terminal.dispose();
//     openCapturedTerminal();
//   }
// });

// function getDefaultShell(): string {
//   if (process.platform !== "win32") {
//     return os.userInfo().shell;
//   }
//   switch (process.platform) {
//     case "win32":
//       return process.env.COMSPEC || "cmd.exe";
//     // case "darwin":
//     //   return process.env.SHELL || "/bin/zsh";
//     // default:
//     //   return process.env.SHELL || "/bin/sh";
//   }
// }

// function getRootDir(): string | undefined {
//   var isWindows = os.platform() === "win32";
//   let cwd = isWindows ? process.env.USERPROFILE : process.env.HOME;
//   if (
//     vscode.workspace.workspaceFolders &&
//     vscode.workspace.workspaceFolders.length > 0
//   ) {
//     cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
//   }
//   return cwd;
// }

// export function openCapturedTerminal(
//   snoopers: TerminalSnooper<string>[] = DEFAULT_SNOOPERS
// ) {
//   // If there is another existing, non-Continue terminal, delete it
//   let terminals = vscode.window.terminals;
//   for (let i = 0; i < terminals.length; i++) {
//     if (terminals[i].name != "Continue") {
//       terminals[i].dispose();
//     }
//   }

//   let env = { ...(process.env as any) };
//   if (os.platform() !== "win32") {
//     env["PATH"] += ":" + ["/opt/homebrew/bin", "/opt/homebrew/sbin"].join(":");
//   }

//   var ptyProcess = pty.spawn(getDefaultShell(), [], {
//     name: "xterm-256color",
//     cols: 160, // TODO: Get size of vscode terminal, and change with resize
//     rows: 26,
//     cwd: getRootDir(),
//     env,
//     useConpty: true,
//   });

//   const writeEmitter = new vscode.EventEmitter<string>();

//   ptyProcess.onData((data: any) => {
//     // Let each of the snoopers see the new data
//     for (let snooper of snoopers) {
//       snooper.onData(data);
//     }

//     // Pass data through to terminal
//     writeEmitter.fire(data);
//   });
//   process.on("exit", () => ptyProcess.kill());

//   const newPty: vscode.Pseudoterminal = {
//     onDidWrite: writeEmitter.event,
//     open: () => {},
//     close: () => {},
//     handleInput: (data) => {
//       for (let snooper of snoopers) {
//         snooper.onWrite(data);
//       }
//       ptyProcess.write(data);
//     },
//   };
//   const terminal = vscode.window.createTerminal({
//     name: "Continue",
//     pty: newPty,
//   });
//   terminal.show();

//   setTimeout(() => {
//     ptyProcess.write("clear\r");
//   }, 500);
// }
