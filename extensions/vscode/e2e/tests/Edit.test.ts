import { expect } from "chai";
import {
  CodeLens,
  TextEditor,
  VSBrowser,
  WebView,
  Workbench,
} from "vscode-extension-tester";

import { EditActions } from "../actions/Edit.actions";
import { GlobalActions } from "../actions/Global.actions";
import { GUIActions } from "../actions/GUI.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

describe("Edit Test", () => {
  let view: WebView;
  let editor: TextEditor;
  let originalEditorText = "Hello world!";
  let { userMessage, llmResponse } = TestUtils.generateTestMessagePair();

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    await GUIActions.moveContinueToSidebar(VSBrowser.instance.driver);
    await GlobalActions.openTestWorkspace();
    ({ editor } = await GlobalActions.createAndOpenNewTextFile());
    await GlobalActions.disableNextEdit();
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    // Don't toggle the Continuous view here: "focus input" flips it open/closed
    // depending on what the previous test left behind. Cmd+I below opens it.
    await resetEditorAndSelectAll();

    ({ view } = await openEditInputWithRetry());

    await GUIActions.sendMessage({
      view,
      message: userMessage,
      inputFieldIndex: 0,
    });

    await view.switchBack();

    await TestUtils.waitForSuccess(async () => {
      const editorText = await editor.getText();
      return editorText.includes(llmResponse);
    });
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await VSBrowser.instance.driver.switchTo().defaultContent();

    // Best effort: leave edit mode and drop any diff that is still pending
    // (both are no-ops when the test already accepted/rejected), so nothing
    // leaks into the next test.
    for (const command of [
      "continuous.exitEditMode",
      "continuous.rejectDiff",
    ]) {
      try {
        await new Workbench().executeCommand(command);
      } catch (e) {
        console.error(`Failed to run ${command} during cleanup: ${e}`);
      }
    }

    try {
      await TestUtils.waitForSuccess(async () => {
        expect(await editor.getCodeLens("Accept")).to.be.undefined;
      }, DEFAULT_TIMEOUT.SM);
    } catch (e) {
      console.error(`Edit CodeLens still visible during cleanup: ${e}`);
    }

    await resetEditorAndSelectAll();
  });

  /**
   * Put the editor into a known state: focused, containing exactly the
   * original text, with all of it selected. Selecting with Ctrl+A rather than
   * editor.typeTextAt/selectText avoids their Ctrl+G / find-widget quick
   * inputs, which are "not interactable" when keyboard focus is in a webview.
   * Idempotent, so it is retried until the document really has the expected
   * text.
   */
  async function resetEditorAndSelectAll() {
    const driver = VSBrowser.instance.driver;
    await driver.switchTo().defaultContent();
    await TestUtils.waitForSuccess(async () => {
      // setText focuses the editor itself (even if a webview had focus) and
      // replaces the whole document.
      await editor.setText(originalEditorText);
      expect((await editor.getText()).trim()).to.equal(originalEditorText);
      // getText() collapses the selection, so select everything afterwards,
      // sending the keys to whichever element VS Code has focused.
      await editor.focus();
      await driver
        .actions()
        .keyDown(TestUtils.osControlKey)
        .sendKeys("a")
        .keyUp(TestUtils.osControlKey)
        .perform();
    }, DEFAULT_TIMEOUT.MD);
  }

  /**
   * Cmd+I is dropped when keyboard focus is stuck in a hidden webview, and the
   * webview takes a moment to show and render its input. Press the shortcut and
   * wait until the visible Continuous webview has its input; press again if not.
   */
  async function openEditInputWithRetry(attempts = 3) {
    const driver = VSBrowser.instance.driver;
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      await driver.switchTo().defaultContent();
      await EditActions.invokeEditShortcut(editor);
      try {
        return await TestUtils.waitForSuccess(async () => {
          const result = await GUIActions.switchToReactIframe({
            requireDisplayed: true,
          });
          await GUISelectors.getMessageInputFieldAtIndex(result.view, 0);
          return result;
        }, DEFAULT_TIMEOUT.SM);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  async function getCodeLensWithRetry(editor: TextEditor, text: string) {
    let codeLens: CodeLens | undefined;
    await TestUtils.waitForSuccess(async () => {
      codeLens = await editor.getCodeLens(text);
      expect(codeLens).to.not.be.undefined;
    }, DEFAULT_TIMEOUT.SM);
    return codeLens;
  }

  it("Accepts an Edit in the GUI", async () => {
    ({ view } = await GUIActions.switchToReactIframe());

    await EditActions.acceptEditInGUI(view);

    await view.switchBack();

    await TestUtils.waitForSuccess(async () => {
      const editorText = await editor.getText();

      expect(
        !editorText.includes(originalEditorText) &&
          editorText.includes(llmResponse),
      ).to.be.true;
    }, DEFAULT_TIMEOUT.SM);
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Rejects an Edit in the GUI", async () => {
    ({ view } = await GUIActions.switchToReactIframe());

    await EditActions.rejectEditInGUI(view);

    await view.switchBack();

    await TestUtils.waitForSuccess(async () => {
      const editorText = await editor.getText();

      expect(
        editorText.includes(originalEditorText) &&
          !editorText.includes(llmResponse),
      ).to.be.true;
    }, DEFAULT_TIMEOUT.SM);
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Accepts an Edit using CodeLens buttons", async () => {
    const acceptCodeLens = await editor.getCodeLens("Accept");
    await acceptCodeLens?.click();

    await TestUtils.waitForSuccess(async () => {
      const editorText = await editor.getText();

      expect(
        !editorText.includes(originalEditorText) &&
          editorText.includes(llmResponse),
      ).to.be.true;
    }, DEFAULT_TIMEOUT.SM);
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Rejects an Edit using CodeLens buttons", async () => {
    const rejectCodeLens = await getCodeLensWithRetry(editor, "Reject");
    await rejectCodeLens?.click();

    await TestUtils.waitForSuccess(async () => {
      const editorText = await editor.getText();

      expect(
        editorText.includes(originalEditorText) &&
          !editorText.includes(llmResponse),
      ).to.be.true;
    }, DEFAULT_TIMEOUT.SM);
  }).timeout(DEFAULT_TIMEOUT.XL);
});
