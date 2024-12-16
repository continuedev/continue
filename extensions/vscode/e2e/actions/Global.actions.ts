import { VSBrowser, WebView } from "vscode-extension-tester";
import * as path from "path";

export class GlobalActions {
  public static async openTestWorkspace() {
    return VSBrowser.instance.openResources(path.join("e2e/test-continue"));
  }
}
