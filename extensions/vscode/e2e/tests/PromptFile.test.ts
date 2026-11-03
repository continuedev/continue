import { expect } from "chai";
import {
  EditorView,
  InputBox,
  Key,
  TextEditor,
  VSBrowser,
  Workbench,
  By,
} from "vscode-extension-tester";

import { GlobalActions } from "../actions/Global.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { TestUtils } from "../TestUtils";

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
    editor = (await TestUtils.waitForSuccess(
      () => new EditorView().openEditor("Untitled-1"),
      DEFAULT_TIMEOUT.SM,
    )) as TextEditor;
  });

  /**
   * Wait until the suggest widget is open and its first (the one Tab accepts)
   * entry is the expected provider, rather than sleeping and hoping the
   * completion list has arrived and settled.
   */
  async function waitForFirstSuggestion(provider: string) {
    const driver = VSBrowser.instance.driver;
    await TestUtils.waitForSuccess(async () => {
      const rows = await driver.findElements(
        By.css(".suggest-widget.visible .monaco-list-row"),
      );
      if (rows.length === 0) throw new Error("No suggestions shown yet");
      const label = (await rows[0].getAttribute("aria-label")) ?? "";
      if (!label.includes(provider)) {
        throw new Error(`First suggestion is "${label}", not ${provider}`);
      }
    }, DEFAULT_TIMEOUT.SM);
  }

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

      // Type the first few characters
      await editor.typeText(provider.slice(0, 2));

      // Wait for the completion popup to show the provider first
      await waitForFirstSuggestion(provider);

      // Use Tab to accept completion instead of Enter
      await editor.typeText(Key.TAB);

      await TestUtils.waitForSuccess(async () => {
        expect(await editor.getText()).to.include("@" + provider);
      }, DEFAULT_TIMEOUT.SM);
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
