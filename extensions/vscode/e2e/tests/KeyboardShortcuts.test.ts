import { expect } from "chai";
import {
  EditorView,
  InputBox,
  Key,
  TextEditor,
  VSBrowser,
  WebDriver,
  WebElement,
  WebView,
  Workbench,
  until,
} from "vscode-extension-tester";

import { GUIActions } from "../actions/GUI.actions";
import { KeyboardShortcutsActions } from "../actions/KeyboardShortcuts.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

describe("Keyboard Shortcuts", () => {
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

  it("Should correctly undo and redo using keyboard shortcuts when writing a chat message", async () => {
    await GUIActions.executeFocusContinueInputShortcut(driver);
    ({ view } = await GUIActions.switchToReactIframe());
    const chatInput = await TestUtils.waitForSuccess(async () => {
      return GUISelectors.getMessageInputFieldAtIndex(view, 0);
    });

    await chatInput.sendKeys("HELLO ");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);

    await chatInput.sendKeys("WORLD ");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);

    await chatInput.sendKeys("HELLO ");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);

    await chatInput.sendKeys("CONTINUE");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);

    await chatInput.sendKeys(TestUtils.osControlKey + "z");
    await driver.wait(
      until.elementTextIs(chatInput, "HELLO WORLD"),
      DEFAULT_TIMEOUT.SM,
    );

    await chatInput.sendKeys(TestUtils.osControlKey + "z");
    await driver.wait(until.elementTextIs(chatInput, ""), DEFAULT_TIMEOUT.SM);

    await chatInput.sendKeys(Key.SHIFT + TestUtils.osControlKey + "z");
    await driver.wait(
      until.elementTextIs(chatInput, "HELLO"),
      DEFAULT_TIMEOUT.SM,
    );

    await chatInput.sendKeys(Key.SHIFT + TestUtils.osControlKey + "z");
    await driver.wait(
      until.elementTextIs(chatInput, "HELLO WORLD"),
      DEFAULT_TIMEOUT.SM,
    );

    await chatInput.sendKeys(Key.SHIFT + TestUtils.osControlKey + "z");
    await driver.wait(
      until.elementTextIs(chatInput, "HELLO WORLD HELLO"),
      DEFAULT_TIMEOUT.SM,
    );

    await chatInput.sendKeys(Key.SHIFT + TestUtils.osControlKey + "z");
    await driver.wait(
      until.elementTextIs(chatInput, "HELLO WORLD HELLO CONTINUE"),
      DEFAULT_TIMEOUT.SM,
    );
  }).timeout(DEFAULT_TIMEOUT.XL);

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

    await driver.wait(until.elementIsNotVisible(textInput), DEFAULT_TIMEOUT.XS);
    expect(await textInput.isDisplayed()).to.equal(false);
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Send a message → focus code editor (not sidebar) → cmd+L → should focus sidebar and start a new session", async () => {
    await GUIActions.executeFocusContinueInputShortcut(driver);
    ({ view } = await GUIActions.switchToReactIframe());

    const { userMessage: userMessage0 } = TestUtils.generateTestMessagePair(0);

    await GUIActions.sendMessage({
      view,
      message: userMessage0,
      inputFieldIndex: 0,
    });

    await view.switchBack();

    KeyboardShortcutsActions.HACK__typeWithSelect(editor, "hello");

    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);

    await GUIActions.executeFocusContinueInputShortcut(driver);

    ({ view } = await GUIActions.switchToReactIframe());

    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);

    const textInput = await TestUtils.waitForSuccess(() =>
      GUISelectors.getMessageInputFieldAtIndex(view, 0),
    );
    const activeElement: WebElement = await driver.switchTo().activeElement();
    const textInputHtml = await textInput.getAttribute("outerHTML");
    const activeElementHtml = await activeElement.getAttribute("outerHTML");
    expect(textInputHtml).to.equal(activeElementHtml);

    await GUIActions.executeFocusContinueInputShortcut(driver);

    await driver.wait(until.elementIsNotVisible(textInput), DEFAULT_TIMEOUT.XS);
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
