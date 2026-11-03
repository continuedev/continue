import { expect } from "chai";
import {
  CodeLens,
  TextEditor,
  VSBrowser,
  WebView,
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

    await GUIActions.toggleGui();

    // Toggling the Continued view can leave keyboard focus inside its (possibly
    // hidden) webview; give the editor focus explicitly before typing into it.
    await VSBrowser.instance.driver.switchTo().defaultContent();
    await TestUtils.waitForSuccess(() => editor.click());

    await editor.typeTextAt(1, 1, originalEditorText);
    await editor.selectText(originalEditorText);

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
    await editor.clearText();

    // Best effort: the next beforeEach opens a fresh edit input anyway, and the
    // webview may legitimately be hidden here (e.g. after accepting an edit).
    try {
      ({ view } = await GUIActions.switchToReactIframe({
        requireDisplayed: true,
      }));
      const tipTapEditor = await GUISelectors.getMessageInputFieldAtIndex(
        view,
        0,
      );
      await tipTapEditor.clear();
    } catch (e) {
      console.error(`Failed to clear the edit input: ${e}`);
    } finally {
      await VSBrowser.instance.driver.switchTo().defaultContent();
    }
  });

  /**
   * Cmd+I is dropped when keyboard focus is stuck in a hidden webview, and the
   * webview takes a moment to show and render its input. Press the shortcut and
   * wait until the visible Continued webview has its input; press again if not.
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
