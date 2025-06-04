import { Core } from "core/core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { InProcessMessenger } from "core/protocol/messenger";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { LightIde } from "./LightIde";
import { NodeGUI } from "./NodeGUI";
import { v4 as uuidv4 } from "uuid";
import path from "path";

async function main() {
  const windowId = uuidv4();
  const webviewProtocol = new NodeGUI({ windowId });

  // // Promise to allow `LightIde` to reference webviewProtocol before it's ready
  let resolveWebviewProtocol!: (protocol: any) => void;
  const webviewProtocolPromise = new Promise<any>((resolve) => {
    resolveWebviewProtocol = resolve;
  });

  const ide = new LightIde(webviewProtocolPromise);
  resolveWebviewProtocol(webviewProtocol);

  const messenger = new InProcessMessenger<ToCoreProtocol, FromCoreProtocol>();
  const core = new Core(messenger, ide);

  // webviewProtocol.setCore(core); // so GUI can call core.invoke

  // // Load config
  // await core.configHandler.loadConfig();

  console.log("Continue AI (Light IDE) initialized.");
  console.log("Open http://localhost:3000 to use the GUI.");
}

main();
