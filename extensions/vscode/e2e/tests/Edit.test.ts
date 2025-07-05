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

    try {
      // Clear previous editor content
      await editor.clearText();
      
      // Toggle GUI with increased timeout
      await TestUtils.waitForSuccess(async () => {
        await GUIActions.toggleGui();
      }, DEFAULT_TIMEOUT.MD);

      // Type and select text
      await editor.typeTextAt(1, 1, originalEditorText);
      await editor.selectText(originalEditorText);

      // Invoke edit shortcut with retry
      await TestUtils.waitForSuccess(async () => {
        await EditActions.invokeEditShortcut(editor);
      }, DEFAULT_TIMEOUT.MD);

      // Switch to React iframe with increased reliability
      await TestUtils.waitForSuccess(async () => {
        ({ view } = await GUIActions.switchToReactIframe());
        expect(view).to.not.be.undefined;
      }, DEFAULT_TIMEOUT.MD);

      // Send message
      await GUIActions.sendMessage({
        view,
        message: userMessage,
        inputFieldIndex: 0,
      });

      // Switch back to main editor
      await view.switchBack();

      // Wait for LLM response
      await TestUtils.waitForSuccess(async () => {
        const editorText = await editor.getText();
        return editorText.includes(llmResponse);
      }, DEFAULT_TIMEOUT.MD);
    } catch (error) {
      console.error("Error in beforeEach:", error);
      throw error;
    }
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    
    try {
      // First switch to React iframe to ensure we can access it
      try {
        ({ view } = await GUIActions.switchToReactIframe());
        
        // Try to clear the message input field
        try {
          const tipTapEditor = await GUISelectors.getMessageInputFieldAtIndex(
            view,
            0,
          );
          if (tipTapEditor) {
            await tipTapEditor.clear();
          }
        } catch (e) {
          console.log("Could not clear input field, continuing anyway:", e);
        }
        
        // Switch back to main context
        await view.switchBack();
      } catch (e) {
        console.log("Could not switch to iframe, continuing anyway:", e);
      }
      
      // Clear editor text with retry
      await TestUtils.waitForSuccess(async () => {
        await editor.clearText();
      }, DEFAULT_TIMEOUT.SM);
    } catch (error) {
      console.error("Error in afterEach:", error);
      // Don't rethrow, let the test continue
    }
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
    // Get a fresh view reference to avoid stale element errors
    await TestUtils.waitForSuccess(async () => {
      ({ view } = await GUIActions.switchToReactIframe());
    }, DEFAULT_TIMEOUT.MD);

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
    const acceptCodeLens = await getCodeLensWithRetry(editor, "Accept");
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