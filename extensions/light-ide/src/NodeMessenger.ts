import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";
import { ToIdeFromWebviewProtocol } from "core/protocol/ideWebview";
import { InProcessMessenger, Message } from "core/protocol/messenger";

import { CORE_TO_WEBVIEW_PASS_THROUGH, WEBVIEW_TO_CORE_PASS_THROUGH } from "core/protocol/passThrough";
import { LightIde } from "./LightIde";
import { NodeGUI } from "./NodeGUI";

// Combine protocols that target the IDE from either Core or Webview
export type ToIdeProtocol = ToIdeFromCoreProtocol & ToIdeFromWebviewOrCoreProtocol & ToIdeFromWebviewProtocol;
export class NodeMessenger {
  constructor(
    private readonly messenger: InProcessMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly nodeGui: NodeGUI,
    private readonly ide: LightIde,
    private lastSentMessages = new Map<string, string>()
  ) {
    // Helper to register a handler for both core and GUI/webview
    const registerHandler = <T extends keyof ToIdeProtocol>(
      messageType: T,
      handler: (
        msg: Message<ToIdeProtocol[T][0]>
      ) => Promise<ToIdeProtocol[T][1]> | ToIdeProtocol[T][1]
    ) => {
      this.on(messageType, handler);
      this.nodeGui.on(messageType, handler);
    };

    registerHandler("getIdeSettings", async () => this.ide.getIdeSettings());
    registerHandler("getDiff", async (msg) => this.ide.getDiff(msg.data.includeUnstaged));
    registerHandler("getTerminalContents", async () => this.ide.getTerminalContents());
    registerHandler("getDebugLocals", async () => this.ide.getDebugLocals());
    registerHandler("getAvailableThreads", async () => this.ide.getAvailableThreads());
    registerHandler("getTopLevelCallStackSources", async () => this.ide.getTopLevelCallStackSources());
    registerHandler("getWorkspaceDirs", async () => this.ide.getWorkspaceDirs());
    registerHandler("writeFile", async (msg) => this.ide.writeFile(msg.data.path, msg.data.contents));
    registerHandler("showVirtualFile", async (msg) => this.ide.showVirtualFile(msg.data.name, msg.data.content));
    registerHandler("openFile", async (msg) => this.ide.openFile(msg.data.path));
    registerHandler("runCommand", async (msg) => this.ide.runCommand(msg.data.command));
    registerHandler("getSearchResults", async (msg) => this.ide.getSearchResults(msg.data.query));
    registerHandler("getFileResults", async (msg) => this.ide.getFileResults(msg.data.pattern));
    registerHandler("subprocess", async (msg) => this.ide.subprocess(msg.data.command, msg.data.cwd));
    registerHandler("getProblems", async (msg) => this.ide.getProblems(msg.data.filepath));
    registerHandler("getBranch", async (msg) => this.ide.getBranch(msg.data.dir));
    registerHandler("getOpenFiles", async () => this.ide.getOpenFiles());
    registerHandler("getCurrentFile", async (msg) => this.ide.getCurrentFile());
    registerHandler("getPinnedFiles", async () => this.ide.getPinnedFiles());
    registerHandler("showLines", async (msg) => this.ide.showLines(msg.data.filepath, msg.data.startLine, msg.data.endLine));
    registerHandler("showToast", async (msg) => this.ide.showToast("info", "Idan", ...msg.data));
    registerHandler("getControlPlaneSessionInfo", async () => undefined);
    registerHandler("saveFile", async (msg) => this.ide.saveFile(msg.data.filepath));
    registerHandler("readFile", async (msg) => this.ide.readFile(msg.data.filepath));
    registerHandler("openUrl", async (msg) => this.ide.openUrl(msg.data));
    registerHandler("fileExists", async (msg) => this.ide.fileExists(msg.data.filepath));
    registerHandler("gotoDefinition", async (msg) => this.ide.gotoDefinition(msg.data.location));
    registerHandler("getFileStats", async (msg) => this.ide.getFileStats(msg.data.files));
    registerHandler("getGitRootPath", async (msg) => this.ide.getGitRootPath(msg.data.dir));
    registerHandler("listDir", async (msg) => this.ide.listDir(msg.data.dir));
    registerHandler("getRepoName", async (msg) => this.ide.getRepoName(msg.data.dir));
    registerHandler("getTags", async (msg) => this.ide.getTags(msg.data));
    registerHandler("getIdeInfo", async () => this.ide.getIdeInfo());
    registerHandler("isTelemetryEnabled", async () => this.ide.isTelemetryEnabled());
    registerHandler("getWorkspaceConfigs", async () => this.ide.getWorkspaceConfigs());
    registerHandler("getUniqueId", async () => this.ide.getUniqueId());
    registerHandler("applyToFile", async (msg: any) => this.ide.writeFile(msg.data.filepath, msg.data.text));

    // Extend with more handlers as needed...
    // --- PASS-THROUGH: Core → GUI ---
    CORE_TO_WEBVIEW_PASS_THROUGH.forEach((messageType) => {
      this.messenger.externalOn(messageType, async (msg) => {
        const dataStr = JSON.stringify(msg.data);
        const last = this.lastSentMessages.get(messageType);
    
        // Skip sending if content hasn't changed
        if (last === dataStr) {
          return;
        }
    
        this.lastSentMessages.set(messageType, dataStr);
        return this.nodeGui.request(messageType, msg.data, msg.messageId);
      });
    });
    

    // Pass-through: Webview/GUI -> Core
    WEBVIEW_TO_CORE_PASS_THROUGH.forEach((messageType) => {
      // Listen for this message from the GUI, forward to core via messenger
      this.nodeGui.on(messageType, async (msg) => {
        // console.log(`NodeMessenger: Received message from GUI: ${messageType} data: ${msg.data} Id: ${msg.messageId}`);
        return await this.messenger.externalRequest(
          messageType,
          msg.data,
          msg.messageId,
        );
      });
    });
  }

  // Currently in runtime messages are not being forwarded to core
  private on<T extends keyof ToIdeProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeProtocol[T][0]>
    ) => Promise<ToIdeProtocol[T][1]> | ToIdeProtocol[T][1],
  ) {
    this.messenger.externalOn(messageType as any, handler);
  }

  // FIXME - 
  // private on<T extends keyof FromWebviewProtocol>(
  //   messageType: T,
  //   handler: Handler<FromWebviewProtocol[T][0], FromWebviewProtocol[T][1]>,
  // ) {
  //   this.protocol.on(messageType, handler);
  // }

}
