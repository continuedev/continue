import {
  EditorView,
  InputBox,
  TextEditor,
  VSBrowser,
  Workbench,
} from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";

export class GlobalActions {
  public static async openTestWorkspace() {
    return VSBrowser.instance.openResources("e2e/test-continue");
  }

  public static async clearAllNotifications() {
    await new Workbench().executeCommand(
      "Notifications: Clear All Notifications",
    );
  }

  public static async createAndOpenNewTextFile(): Promise<{
    editor: TextEditor;
  }> {
    await new Workbench().executeCommand("Create: New File...");
    await (
      await InputBox.create(DEFAULT_TIMEOUT.MD)
    ).selectQuickPick("Text File");
    const editor = (await new EditorView().openEditor(
      "Untitled-1",
    )) as TextEditor;

    return { editor };
  }
}
