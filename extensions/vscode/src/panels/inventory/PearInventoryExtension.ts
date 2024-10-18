// import * as vscode from "vscode";
// import { PearInventoryPanel } from "./PearInventoryPanel";

// export class PearInventoryExtension {
//   private outputChannel: vscode.OutputChannel;
//   private pearInventoryPanel: PearInventoryPanel | null = null;

//   constructor(
//     private context: vscode.ExtensionContext,
//     outputChannel: vscode.OutputChannel,
//   ) {
//     this.outputChannel = outputChannel;
//   }

//   async activate() {
//     this.outputChannel.appendLine(
//       "Pear activation started11=======================",
//     );

//     this.pearInventoryPanel = new PearInventoryPanel(
//       this.context.extensionUri,
//       this.context,
//     );

//     this.context.subscriptions.push(
//       vscode.window.registerWebviewViewProvider(
//         "pearai.overlayWebview2",
//         this.pearInventoryPanel,
//       ),
//     );

//     this.outputChannel.appendLine("Pear Inventory extension activated!!");
//     console.log("Pear Inventory extension activated!!!");
//   }
//   // TODO: Disposal needed?
//   async deactivate(): Promise<void> {
//     await this.pearInventoryPanel?.deactivate();
//   }
// }
