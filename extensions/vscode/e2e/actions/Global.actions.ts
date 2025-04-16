import {
  EditorView,
  InputBox,
  TextEditor,
  VSBrowser,
  Workbench,
} from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { TestUtils } from "../TestUtils";

export class GlobalActions {
  static defaultFolder = "e2e/test-continue";
  public static defaultNewFilename = "test.py";

  public static async openTestWorkspace() {
    await VSBrowser.instance.openResources(GlobalActions.defaultFolder);
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

  public static async createAndSaveNewFile(
    filename = GlobalActions.defaultNewFilename,
  ): Promise<{
    editor: TextEditor;
  }> {
    let { editor } = await GlobalActions.createAndOpenNewTextFile();

    await new Workbench().executeCommand("File: Save As...");
    const inputBox = await InputBox.create(DEFAULT_TIMEOUT.MD);

    // Get current path and replace filename
    const currentPath = await inputBox.getText();
    const pathParts = currentPath.split(/[\/\\]/);
    pathParts[pathParts.length - 1] = filename;
    const newPath = pathParts.join("/");

    await inputBox.setText(newPath);

    await inputBox.confirm();
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);

    editor = (await new EditorView().openEditor(filename)) as TextEditor;

    return { editor };
  }

  public static async deleteFileFromFolder(
    filename = GlobalActions.defaultNewFilename,
    folder = GlobalActions.defaultFolder,
  ): Promise<void> {
    const fs = require("fs");
    const path = require("path");

    const folderPath = path.join(process.cwd(), folder);
    const filePath = path.join(folderPath, filename);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to delete file ${filePath}:`, error);
    }
  }
}
