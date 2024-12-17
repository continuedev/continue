import {
  WebDriver,
  Key,
  VSBrowser,
  EditorView,
  InputBox,
  TextEditor,
  Workbench,
  waitForAttributeValue,
  until,
} from "vscode-extension-tester";
import { DEFAULT_TIMEOUT } from "../constants";
import { GlobalActions } from "../actions/Global.actions";
import { GUISelectors } from "../selectors/GUI.selectors";
import { GUIActions } from "../actions/GUI.actions";
import { expect } from "chai";
import { TestUtils } from "../TestUtils";
import { Test } from "mocha";

describe("Cmd+L Shortcut Test", () => {
  let driver: WebDriver;

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GlobalActions.openTestWorkspace();

    await TestUtils.waitForSuccess(async () => {
      await new Workbench().executeCommand("Create: New File...");
      await (
        await InputBox.create(DEFAULT_TIMEOUT.MD)
      ).selectQuickPick("Text File");
    });

    driver = VSBrowser.instance.driver;
  });

  it("should select the current line with Cmd+L", async () => {
    const text = "Hello, world!";

    const editor = (await new EditorView().openEditor(
      "Untitled-1",
    )) as TextEditor;
    await editor.setText(text);
    await editor.selectText(text);

    // Simulate Cmd+L
    await driver
      .actions()
      .keyDown(Key.CONTROL) // Use Key.CONTROL for Windows/Linux
      .sendKeys("l")
      .keyUp(Key.META)
      .perform();

    const { view } = await GUIActions.switchToReactIframe();

    const codeBlock = await TestUtils.waitForSuccess(() =>
      GUISelectors.getInputBoxCodeBlockAtIndex(view, 0),
    );
    const codeblockContent = await codeBlock.getAttribute(
      "data-codeblockcontent",
    );

    expect(codeblockContent).to.equal(text);
  }).timeout(DEFAULT_TIMEOUT.XL);
});
