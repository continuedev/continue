import { expect } from "chai";
import {
  EditorView,
  InputBox,
  Key,
  TextEditor,
  Workbench,
} from "vscode-extension-tester";

import { GlobalActions } from "../actions/Global.actions";
import { DEFAULT_TIMEOUT } from "../constants";

describe("Prompt file", () => {
  let editor: TextEditor;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.MD);
    await GlobalActions.disableNextEdit();
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GlobalActions.openTestWorkspace();
    await new Workbench().executeCommand("File: New Untitled Text File");
    await new Workbench().executeCommand("Change Language Mode");
    const inputBox = await new InputBox();
    await inputBox.setText("Prompt Language");
    await inputBox.confirm();
    editor = (await new EditorView().openEditor("Untitled-1")) as TextEditor;
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    await editor.clearText();
    await new EditorView().closeAllEditors();
  });

  it("Should display intellisense for default context providers and preamble", async () => {
    // Check that "@" dropdown in body works
    const providers = [
      "currentFile",
      "open",
      "os",
      "problems",
      "repo-map",
      "terminal",
      "tree",
    ];

    for (const provider of providers) {
      // Type the @ symbol to trigger completion
      await editor.typeText("@");

      // Wait a moment for the completion to appear
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Type the first few characters
      await editor.typeText(provider.slice(0, 2));

      // Wait for completion popup to update
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Use Tab to accept completion instead of Enter
      await editor.typeText(Key.TAB);

      const text = await editor.getText();
      expect(text).to.include("@" + provider);
      await editor.clearText();
    }

    // Check that dropdown for properties in preamble works
    // await editor.typeText(Key.ENTER);
    // await editor.typeText(Key.ENTER);
    // await editor.typeText("---");
    // await editor.typeText(Key.UP);
    // await editor.typeText(Key.UP);
    // await editor.typeText(Key.SPACE);
    // await editor.typeText(Key.BACK_SPACE);
    // await editor.typeText(Key.ENTER);
    // const text = await editor.getText();
    // expect(text).equals("description: \n\n---");
  }).timeout(DEFAULT_TIMEOUT.XL);
});
