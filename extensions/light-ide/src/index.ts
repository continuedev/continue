import { Core } from "core/core";
import { InProcessMessenger } from "core/protocol/messenger";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { LightIde } from "./LightIde";
import { NodeGUI } from "./NodeGUI";
import { v4 as uuidv4 } from "uuid";
import { NodeMessenger } from "./NodeMessenger";
import { getConfigYamlPath } from "core/util/paths";
import fs from "fs";

async function main() {
  const windowId = uuidv4();
  const nodeGui = new NodeGUI({ windowId });

  // // Promise to allow `LightIde` to reference webviewProtocol before it's ready
  let resolveWebviewProtocol!: (protocol: any) => void;
  const webviewProtocolPromise = new Promise<any>((resolve) => {
    resolveWebviewProtocol = resolve;
  });

  const ide = new LightIde(webviewProtocolPromise);
  resolveWebviewProtocol(nodeGui);

  const messenger = new InProcessMessenger<ToCoreProtocol, FromCoreProtocol>();
  messenger.externalOn("getIdeInfo", async () => ide.getIdeInfo());
  new NodeMessenger(
    messenger,
    nodeGui,
    ide
  );

  const core = new Core(messenger, ide);

  nodeGui.setCore(core); // so GUI can call core.invoke

  // Load config
  const config = await core.configHandler.loadConfig();
  // console.log("Loaded config:", JSON.stringify(config));

  // Watch YAML config file specific to your Node IDE
  fs.watchFile(
    getConfigYamlPath("vscode"), // <-- Change this if your environment is named differently
    { interval: 1000 },
    async (stats) => {
      if (stats.size === 0) {
        return;
      }
      await core.configHandler.reloadConfig();
      console.log("🔁 YAML config reloaded due to file change.");
    }
  );
  console.log("Continue AI (Light IDE) initialized.");
  // console.log("Open http://localhost:3000 to use the GUI.");
}

main().catch((err) => {
  console.error("Error initializing Continue AI (Light IDE):", err);
  process.exit(1);
});
