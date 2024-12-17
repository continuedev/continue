import {
  WebDriver,
  VSBrowser,
  EditorView,
  InputBox,
  TextEditor,
  Workbench,
  WebView,
} from "vscode-extension-tester";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { GUIActions } from "../actions/GUI.actions";
import { expect } from "chai";
import { TestUtils } from "../TestUtils";
import { KeyboardShortcutsActions } from "../actions/KeyboardShortcuts.actions";

describe("Cmd+L Shortcut Test", () => {
  let driver: WebDriver;
  let editor: TextEditor;
  let view: WebView;

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await TestUtils.waitForSuccess(async () => {
      await new Workbench().executeCommand("Create: New File...");
      await (
        await InputBox.create(DEFAULT_TIMEOUT.MD)
      ).selectQuickPick("Text File");
    });

    driver = VSBrowser.instance.driver;

    editor = (await new EditorView().openEditor("Untitled-1")) as TextEditor;
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL * 1000);
    await view.switchBack();
    await editor.clearText();
    await TestUtils.waitForSuccess(
      async () => (await GUISelectors.getContinueExtensionBadge(view)).click(),
      DEFAULT_TIMEOUT.XS,
    );

    await new EditorView().closeAllEditors();
  });

  it("Should not create a code block when Cmd+L is pressed without text highlighted", async () => {
    const text = "Hello, world!";

    await editor.setText(text);

    await KeyboardShortcutsActions.executeFocusContinueInput(driver);

    ({ view } = await GUIActions.switchToReactIframe());

    await TestUtils.expectNoElement(async () => {
      return GUISelectors.getInputBoxCodeBlockAtIndex(view, 0);
    }, DEFAULT_TIMEOUT.XS);
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should create a code block when Cmd+L is pressed with text highlighted", async () => {
    const text = "Hello, world!";

    await editor.setText(text);
    await editor.selectText(text);

    await KeyboardShortcutsActions.executeFocusContinueInput(driver);

    ({ view } = await GUIActions.switchToReactIframe());

    const codeBlock = await TestUtils.waitForSuccess(() =>
      GUISelectors.getInputBoxCodeBlockAtIndex(view, 0),
    );
    const codeblockContent = await codeBlock.getAttribute(
      "data-codeblockcontent",
    );

    expect(codeblockContent).to.equal(text);
  }).timeout(DEFAULT_TIMEOUT.XL);
});
