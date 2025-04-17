import { TextEditor, VSBrowser, WebView } from "vscode-extension-tester";

import { ApplyActions } from "../actions/Apply.actions";
import { GlobalActions } from "../actions/Global.actions";
import { GUIActions } from "../actions/GUI.actions";
import { KeyboardShortcutsActions } from "../actions/KeyboardShortcuts.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

/**
 * This file is currently `.skip`'d because the test is consistently failing in CI,
 * bu consistenly passing locally. Screenshots from CI appear to indicate
 * that our `GlobalActions.openTestWorkspace` fn isn't actually working, and therefore
 * our apply button is instead rendering as "Create file" since the file doesn't exist
 * in our workspace.
 *
 * The most recent failing screenshot is here: https://github.com/continuedev/continue/actions/runs/14481877233?pr=5167
 */
describe("Apply Test", () => {
  let view: WebView;
  let editor: TextEditor;
  let fileContent = "hello = 'world'";

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GUIActions.moveContinueToSidebar(VSBrowser.instance.driver);
    await GlobalActions.openTestWorkspace();

    ({ editor } = await GlobalActions.createAndSaveNewFile());
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await editor.typeTextAt(1, 1, fileContent);
    await GUIActions.toggleGui();

    ({ view } = await GUIActions.switchToReactIframe());
    await GUIActions.selectModelFromDropdown(view, "TEST LLM");
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

  after(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    await GlobalActions.deleteFileFromFolder();
  });

  it("Can reject and apply changes from sidebar", async () => {
    const newFileContent = fileContent + "!";

    const [messageInput] = await GUISelectors.getMessageInputFields(view);

    await KeyboardShortcutsActions.typeWithNewlines({
      submit: true,
      input: messageInput,
      lines: [
        "```py " + GlobalActions.defaultNewFilename,
        newFileContent,
        "```",
        "_", // To avoid extra lines getting included in the block
      ],
    });

    await ApplyActions.performAction(view, "apply");
    await ApplyActions.performAction(view, "reject");
    await view.switchBack();

    let editorText = await editor.getText();

    await TestUtils.waitForSuccess(async () => editorText === fileContent);

    ({ view } = await GUIActions.switchToReactIframe());

    await ApplyActions.performAction(view, "apply");
    await ApplyActions.performAction(view, "accept");
    await view.switchBack();

    // Note that the editor after accpeting contains additional text
    // from the default output of the test LLM, so instead of checking
    // for an exact text match on the new content we just do a `.includes()`
    editorText = await editor.getText();
    await TestUtils.waitForSuccess(async () =>
      editorText.includes(newFileContent),
    );
  }).timeout(DEFAULT_TIMEOUT.XL);
});
