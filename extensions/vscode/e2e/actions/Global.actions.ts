import {
  By,
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
    process.env.CONTINUE_E2E_NON_NEXT_EDIT_TEST = "true";

    // Initial wait and clear
    await TestUtils.waitForTimeout(1000);
    await GlobalActions.clearAllNotifications();

    const statusBar = await workbench.getStatusBar();

    // Robust element finding with text validation
    const continueItem = await TestUtils.waitForSuccess(async () => {
      // Clear any new notifications
      try {
        await GlobalActions.clearAllNotifications();
      } catch (e) {
        // Ignore
      }

      const element = await statusBar.findElement(
        By.xpath("//*[contains(text(), 'Continue')]"),
      );

      // Validate we can get text
      const text = await element.getText();
      if (!text || text.trim() === "") {
        // Try alternative methods
        const textContent = await element.getAttribute("textContent");
        if (!textContent || textContent.trim() === "") {
          throw new Error("Text not yet available");
        }
      }

      return element;
    }, DEFAULT_TIMEOUT.MD);

    // Get text with retry
    const text = await TestUtils.waitForSuccess(async () => {
      const itemText = await continueItem.getText();
      if (!itemText || itemText.trim() === "") {
        // Fallback to textContent
        const textContent = await continueItem.getAttribute("textContent");
        if (textContent && textContent.trim() !== "") {
          return textContent;
        }
        throw new Error("Text content not yet available");
      }
      return itemText;
    }, DEFAULT_TIMEOUT.MD);

    console.log("Final text:", text);

    const hasNE = text.includes("(NE)");
    console.log("hasNE:", hasNE);

    if (hasNE !== enabled) {
      await workbench.executeCommand("Continue: Toggle Next Edit");
      // Clear any resulting notifications
      await TestUtils.waitForTimeout(500);
      await GlobalActions.clearAllNotifications();
    }
  }

  static async disableNextEdit() {
    await this.setNextEditEnabled(false);
  }
}
