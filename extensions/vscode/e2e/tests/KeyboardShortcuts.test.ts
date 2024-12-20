import {
  WebDriver,
  VSBrowser,
  EditorView,
  InputBox,
  TextEditor,
  Workbench,
  WebView,
  WebElement,
} from "vscode-extension-tester";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { GUIActions } from "../actions/GUI.actions";
import { expect } from "chai";
import { TestUtils } from "../TestUtils";

describe("Cmd+L Shortcut Test", () => {
  let driver: WebDriver;
  let editor: TextEditor;
  let view: WebView;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    await GUIActions.moveContinueToSidebar(VSBrowser.instance.driver);
  });

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
    await new EditorView().closeAllEditors();
  });

  it("Should not create a code block when Cmd+L is pressed without text highlighted", async () => {
    const text = "Hello, world!";

    await editor.setText(text);

    await GUIActions.executeFocusContinueInputShortcut(driver);

    ({ view } = await GUIActions.switchToReactIframe());

    await TestUtils.expectNoElement(async () => {
      return GUISelectors.getInputBoxCodeBlockAtIndex(view, 0);
    }, DEFAULT_TIMEOUT.XS);
    await GUIActions.executeFocusContinueInputShortcut(driver);
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Fresh VS Code window → sidebar closed → cmd+L with no code highlighted → opens sidebar and focuses input → cmd+L closes sidebar", async () => {
    await GUIActions.executeFocusContinueInputShortcut(driver);
    ({ view } = await GUIActions.switchToReactIframe());
    const textInput = await TestUtils.waitForSuccess(() =>
      GUISelectors.getMessageInputFieldAtIndex(view, 0),
    );
    const activeElement: WebElement = await driver.switchTo().activeElement();
    const textInputHtml = await textInput.getAttribute("outerHTML");
    const activeElementHtml = await activeElement.getAttribute("outerHTML");
    expect(textInputHtml).to.equal(activeElementHtml);
    expect(await textInput.isDisplayed()).to.equal(true);

    await GUIActions.executeFocusContinueInputShortcut(driver);
    expect(await textInput.isDisplayed()).to.equal(false);
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should create a code block when Cmd+L is pressed with text highlighted", async () => {
    const text = "Hello, world!";

    await editor.setText(text);
    await editor.selectText(text);

    await GUIActions.executeFocusContinueInputShortcut(driver);

    ({ view } = await GUIActions.switchToReactIframe());

    const codeBlock = await TestUtils.waitForSuccess(() =>
      GUISelectors.getInputBoxCodeBlockAtIndex(view, 0),
    );
    const codeblockContent = await codeBlock.getAttribute(
      "data-codeblockcontent",
    );

    expect(codeblockContent).to.equal(text);

    await GUIActions.executeFocusContinueInputShortcut(driver);
  }).timeout(DEFAULT_TIMEOUT.XL);
});
