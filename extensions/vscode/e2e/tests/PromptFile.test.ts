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

describe.only("Prompt file", () => {
  let editor: TextEditor;

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

  it("Should display intellisense for default context providers", async () => {
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
      await editor.typeText("@" + provider.slice(0, 2));
      await editor.typeText(Key.ENTER);
      const text = await editor.getText();
      expect(text).equals("@" + provider);
      await editor.clearText();
    }
  }).timeout(DEFAULT_TIMEOUT.XL);
});
