import { FromCoreProtocol, FromWebviewProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger, Message } from "core/protocol/messenger";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";

import { LightIde } from "./LightIde";
import { NodeGUI } from "./NodeGUI";
import { WEBVIEW_TO_CORE_PASS_THROUGH, CORE_TO_WEBVIEW_PASS_THROUGH } from "core/protocol/passThrough";
import { Handler, NodeGuiProtocol } from "./NodeGuiProtocol";

// Combine protocols that target the IDE from either Core or Webview
export type ToIdeProtocol = ToIdeFromCoreProtocol & ToIdeFromWebviewOrCoreProtocol;

export class NodeMessenger {
  constructor(
    private readonly messenger: InProcessMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly nodeGui: NodeGUI,
    // TBD - Trying to resolve message but protoct currently not used
    private protocol: NodeGuiProtocol,
    private readonly ide: LightIde
  ) {
    // Allow GUI to send messages to Core (via InProcessMessenger)
    this.nodeGui.setMessageHandler(async (type: any, data: any, messageId: any) => {
      return this.messenger.externalRequest(type as any, data, messageId);
    });

    // Wire up message handlers from Core (or GUI) to IDE logic
    this.on("getIdeSettings", async () => this.ide.getIdeSettings());
    this.on("getDiff", async (msg) => this.ide.getDiff(msg.data.includeUnstaged));
    this.on("getTerminalContents", async () => this.ide.getTerminalContents());
    this.on("getDebugLocals", async () => this.ide.getDebugLocals());
    this.on("getAvailableThreads", async () => this.ide.getAvailableThreads());
    this.on("getTopLevelCallStackSources", async () => this.ide.getTopLevelCallStackSources());
    this.on("getWorkspaceDirs", async () => this.ide.getWorkspaceDirs());
    this.on("writeFile", async (msg) => this.ide.writeFile(msg.data.path, msg.data.contents));
    this.on("showVirtualFile", async (msg) => this.ide.showVirtualFile(msg.data.name, msg.data.content));
    this.on("openFile", async (msg) => this.ide.openFile(msg.data.path));
    this.on("runCommand", async (msg) => this.ide.runCommand(msg.data.command));
    this.on("getSearchResults", async (msg) => this.ide.getSearchResults(msg.data.query));
    this.on("getFileResults", async (msg) => this.ide.getFileResults(msg.data.pattern));
    this.on("subprocess", async (msg) => this.ide.subprocess(msg.data.command, msg.data.cwd));
    this.on("getProblems", async (msg) => this.ide.getProblems(msg.data.filepath));
    this.on("getBranch", async (msg) => this.ide.getBranch(msg.data.dir));
    this.on("getOpenFiles", async () => this.ide.getOpenFiles());
    this.on("getCurrentFile", async () => this.ide.getCurrentFile());
    this.on("getPinnedFiles", async () => this.ide.getPinnedFiles());
    this.on("showLines", async (msg) => this.ide.showLines(msg.data.filepath, msg.data.startLine, msg.data.endLine));
    this.on("showToast", async (msg) => this.ide.showToast("info", "Idan", ...msg.data));
    this.on("getControlPlaneSessionInfo", async () => undefined);
    this.on("saveFile", async (msg) => this.ide.saveFile(msg.data.filepath));
    this.on("readFile", async (msg) => this.ide.readFile(msg.data.filepath));
    this.on("openUrl", async (msg) => this.ide.openUrl(msg.data));
    this.on("fileExists", async (msg) => this.ide.fileExists(msg.data.filepath));
    this.on("gotoDefinition", async (msg) => this.ide.gotoDefinition(msg.data.location));
    this.on("getFileStats", async (msg) => this.ide.getFileStats(msg.data.files));
    this.on("getGitRootPath", async (msg) => this.ide.getGitRootPath(msg.data.dir));
    this.on("listDir", async (msg) => this.ide.listDir(msg.data.dir));
    this.on("getRepoName", async (msg) => this.ide.getRepoName(msg.data.dir));
    this.on("getTags", async (msg) => this.ide.getTags(msg.data));
    this.on("getIdeInfo", async () => this.ide.getIdeInfo());
    this.on("isTelemetryEnabled", async () => this.ide.isTelemetryEnabled());
    this.on("getWorkspaceConfigs", async () => this.ide.getWorkspaceConfigs());
    this.on("getUniqueId", async () => this.ide.getUniqueId());

    // Extend with more handlers as needed...
    // --- PASS-THROUGH: Core → GUI ---
    CORE_TO_WEBVIEW_PASS_THROUGH.forEach((messageType) => {
      this.messenger.externalOn(messageType, async (msg) => {
        // nodeGui.request should forward to GUI and return a promise if a response is expected
        return this.nodeGui.sendToClient(messageType, msg.data);
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
    this.messenger.externalOn(messageType, handler);
  }

  // FIXME - 
  // private on<T extends keyof FromWebviewProtocol>(
  //   messageType: T,
  //   handler: Handler<FromWebviewProtocol[T][0], FromWebviewProtocol[T][1]>,
  // ) {
  //   this.protocol.on(messageType, handler);
  // }
  
}
