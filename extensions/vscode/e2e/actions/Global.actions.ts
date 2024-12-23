import { VSBrowser, WebView } from "vscode-extension-tester";

export class GlobalActions {
  public static async openTestWorkspace() {
    return VSBrowser.instance.openResources("e2e/test-continue");
  }
}
