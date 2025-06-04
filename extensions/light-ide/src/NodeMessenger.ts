import { ConfigHandler } from "core/config/ConfigHandler";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger, Message } from "core/protocol/messenger";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";

import { LightIde } from "./LightIde";
import { NodeGUI } from "./NodeGUI";

// Combine protocols that target the IDE from either Core or Webview
export type ToIdeProtocol = ToIdeFromCoreProtocol & ToIdeFromWebviewOrCoreProtocol;

export class NodeMessenger {
  constructor(
    private readonly messenger: InProcessMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly webviewProtocol: NodeGUI,
    private readonly ide: LightIde,
    private readonly configHandler: ConfigHandler,
  ) {
    // Allow GUI to send messages to Core (via InProcessMessenger)
    this.webviewProtocol.setMessageHandler(async (type, data, messageId) => {
      return this.messenger.externalRequest(type as any, data, messageId);
    });

    // Wire up message handlers from Core (or GUI) to IDE logic
    this.on("getIdeSettings", async () => this.ide.getIdeSettings());
    this.on("getWorkspaceDirs", async () => this.ide.getWorkspaceDirs());
    this.on("writeFile", async (msg) => this.ide.writeFile(msg.data.path, msg.data.contents));
    this.on("readFile", async (msg) => this.ide.readFile(msg.data.filepath));
    this.on("openFile", async (msg) => this.ide.openFile(msg.data.path));
    this.on("saveFile", async (msg) => this.ide.saveFile(msg.data.filepath));
    this.on("runCommand", async (msg) => this.ide.runCommand(msg.data.command));
    // this.on("showToast", async (msg) => this.ide.showToast("info", msg.data));
    // this.on("getSearchResults", async (msg) => this.ide.getSearchResults(msg.data.query));

    // Extend with more handlers as needed...
  }

  private on<T extends keyof ToIdeProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeProtocol[T][0]>
    ) => Promise<ToIdeProtocol[T][1]> | ToIdeProtocol[T][1],
  ) {
    this.messenger.externalOn(messageType, handler);
  }
}
