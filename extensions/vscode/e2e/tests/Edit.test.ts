import {
  EditorView,
  WebView,
  WebDriver,
  Key,
  VSBrowser,
  InputBox,
  TextEditor,
  Workbench,
} from "vscode-extension-tester";

import { EditActions } from "../actions/Edit.actions";
import { GlobalActions } from "../actions/Global.actions";
import { GUIActions } from "../actions/GUI.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { EditSelectors } from "../selectors/Edit.selectors";
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
  });

  it("Accepts an Edit in the GUI", async () => {
    ({ view } = await GUIActions.switchToReactIframe());

    await EditActions.acceptEditInGUI(view);

    await view.switchBack();

    const editorText = await editor.getText();

    await TestUtils.waitForSuccess(
      async () =>
        !editorText.includes(originalEditorText) &&
        editorText.includes(llmResponse),
      DEFAULT_TIMEOUT.SM,
    );
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Rejects an Edit in the GUI", async () => {
    ({ view } = await GUIActions.switchToReactIframe());

    await EditActions.rejectEditInGUI(view);

    await view.switchBack();

    const editorText = await editor.getText();

    await TestUtils.waitForSuccess(
      async () =>
        editorText.includes(originalEditorText) &&
        !editorText.includes(llmResponse),
      DEFAULT_TIMEOUT.SM,
    );
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Accepts an Edit using CodeLens buttons", async () => {
    const acceptCodeLens = await editor.getCodeLens("Accept");
    await acceptCodeLens?.click();

    const editorText = await editor.getText();

    await TestUtils.waitForSuccess(
      async () =>
        !editorText.includes(originalEditorText) &&
        editorText.includes(llmResponse),
      DEFAULT_TIMEOUT.SM,
    );
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Rejects an Edit using CodeLens buttons", async () => {
    const rejectCodeLens = await editor.getCodeLens("Reject");
    await rejectCodeLens?.click();

    const editorText = await editor.getText();

    await TestUtils.waitForSuccess(
      async () =>
        !editorText.includes(originalEditorText) &&
        editorText.includes(llmResponse),
      DEFAULT_TIMEOUT.SM,
    );
  }).timeout(DEFAULT_TIMEOUT.XL);
});
