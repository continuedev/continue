import {
  By,
  EditorView,
  InputBox,
  TextEditor,
  VSBrowser,
  Workbench
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

  static async setNextEditEnabled(enabled: boolean) {
    const workbench = new Workbench();
    
    await workbench.openCommandPrompt();
    
    // First, check current state by looking at status bar.
    // When Next Edit is enabled, it will show "Continue (NE)".
    // It will also render a warning every time you try to use the model, interfering with e2e tests.
    // If we need to toggle, execute the command.
    const statusBar = await workbench.getStatusBar();
    
    // Wait for the Continue item to be available in the status bar.
    const continueItem = await TestUtils.waitForSuccess(
      async () => await statusBar.findElement(By.xpath("//*[contains(text(), 'Continue')]")),
      DEFAULT_TIMEOUT.MD
    );

    console.log("continueItem:");
    console.log(continueItem);
    
    const text = await continueItem.getText();
    console.log("text:");
    console.log(text);
    
    const hasNE = text.includes('(NE)');
    console.log("hasNE:");
    console.log(hasNE);
    
    if (hasNE !== enabled) {
      await workbench.executeCommand('Continue: Toggle Next Edit');
    }
  }
  
  static async disableNextEdit() {
    await this.setNextEditEnabled(false);
  }
}
