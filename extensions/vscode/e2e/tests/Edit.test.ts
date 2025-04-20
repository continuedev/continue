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
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GUIActions.toggleGui();

    await editor.typeTextAt(1, 1, originalEditorText);
    await editor.selectText(originalEditorText);

    await EditActions.invokeEditShortcut(editor);

    ({ view } = await GUIActions.switchToReactIframe());

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

    await editor.clearText();

    ({ view } = await GUIActions.switchToReactIframe());

    const tipTapEditor = await GUISelectors.getMessageInputFieldAtIndex(
      view,
      0,
    );
    await tipTapEditor.clear();
  });

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

  it.only("Rejects an Edit using CodeLens buttons", async () => {
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
