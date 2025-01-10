import { expect } from "chai";
import {
  EditorView,
  Key,
  VSBrowser,
  WebDriver,
  WebElement,
  WebView,
} from "vscode-extension-tester";
import { GlobalActions } from "../actions/Global.actions";
import { GUIActions } from "../actions/GUI.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

describe("GUI Test", () => {
  let view: WebView;
  let driver: WebDriver;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    await GUIActions.moveContinueToSidebar(VSBrowser.instance.driver);
    await GlobalActions.openTestWorkspace();
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GUIActions.toggleGui();

    ({ view, driver } = await GUIActions.switchToReactIframe());
    await GUIActions.selectModelFromDropdown(view, "TEST LLM");
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await view.switchBack();
    await TestUtils.waitForSuccess(
      async () => (await GUISelectors.getContinueExtensionBadge(view)).click(),
      DEFAULT_TIMEOUT.XS,
    );
    await new EditorView().closeAllEditors();
  });

  describe("Onboarding", () => {
    it("should display correct panel description", async () => {
      const description = await GUISelectors.getDescription(view);

      expect(await description.getText()).has.string(
        "Quickly get up and running using our API keys.",
      );
    }).timeout(DEFAULT_TIMEOUT.XL);
  });

  describe("Chat", () => {
    it("Can submit message by pressing enter", async () => {
      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      const messagePair = TestUtils.generateTestMessagePair();
      await messageInput.sendKeys(messagePair.userMessage);
      await messageInput.sendKeys(Key.ENTER);
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, messagePair.llmResponse),
      );
    });

    it("Can submit message by button click", async () => {
      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      const messagePair = TestUtils.generateTestMessagePair();
      await messageInput.sendKeys(messagePair.userMessage);
      (await GUISelectors.getSubmitInputButton(view)).click();
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, messagePair.llmResponse),
      );
    });

    it("Can delete messages", async () => {
      const { userMessage: userMessage0, llmResponse: llmResponse0 } =
        TestUtils.generateTestMessagePair(0);
      await GUIActions.sendMessage({
        view,
        message: userMessage0,
        inputFieldIndex: 0,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse0),
      );

      const { userMessage: userMessage1, llmResponse: llmResponse1 } =
        TestUtils.generateTestMessagePair(1);
      await GUIActions.sendMessage({
        view,
        message: userMessage1,
        inputFieldIndex: 1,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse1),
      );

      const { userMessage: userMessage2, llmResponse: llmResponse2 } =
        TestUtils.generateTestMessagePair(2);
      await GUIActions.sendMessage({
        view,
        message: userMessage2,
        inputFieldIndex: 2,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse2),
      );

      GUISelectors.getThreadMessageByText(view, llmResponse1);
      await (await GUISelectors.getNthMessageDeleteButton(view, 1)).click();
      await TestUtils.expectNoElement(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse1),
      );

      GUISelectors.getThreadMessageByText(view, llmResponse0);
      await (await GUISelectors.getNthMessageDeleteButton(view, 0)).click();
      await TestUtils.expectNoElement(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse0),
      );

      GUISelectors.getThreadMessageByText(view, llmResponse2);
      await (await GUISelectors.getNthMessageDeleteButton(view, 0)).click();
      await TestUtils.expectNoElement(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse2),
      );
    }).timeout(DEFAULT_TIMEOUT.XL);

    it("Can edit messages", async () => {
      const { userMessage: userMessage0, llmResponse: llmResponse0 } =
        TestUtils.generateTestMessagePair(0);
      await GUIActions.sendMessage({
        view,
        message: userMessage0,
        inputFieldIndex: 0,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse0),
      );

      const { userMessage: userMessage1, llmResponse: llmResponse1 } =
        TestUtils.generateTestMessagePair(1);
      await GUIActions.sendMessage({
        view,
        message: userMessage1,
        inputFieldIndex: 1,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse1),
      );

      const { userMessage: userMessage2, llmResponse: llmResponse2 } =
        TestUtils.generateTestMessagePair(2);
      await GUIActions.sendMessage({
        view,
        message: userMessage2,
        inputFieldIndex: 2,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse2),
      );

      const secondInputField = await GUISelectors.getMessageInputFieldAtIndex(
        view,
        1,
      );
      await secondInputField.clear();

      const { userMessage: userMessage3, llmResponse: llmResponse3 } =
        TestUtils.generateTestMessagePair(3);

      await GUIActions.sendMessage({
        view,
        message: userMessage3,
        inputFieldIndex: 1,
      });
      await GUISelectors.getThreadMessageByText(view, llmResponse0);

      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse3),
      );
      await Promise.all([
        TestUtils.expectNoElement(() =>
          GUISelectors.getThreadMessageByText(view, llmResponse1),
        ),
        TestUtils.expectNoElement(() =>
          GUISelectors.getThreadMessageByText(view, llmResponse2),
        ),
      ]);
    }).timeout(DEFAULT_TIMEOUT.XL);
  });

  describe.skip("Chat with tools", () => {
    it("should render tool call", async () => {
      await GUIActions.selectModelFromDropdown(view, "TOOL MOCK LLM");

      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      await messageInput.sendKeys("Hello");
      await messageInput.sendKeys(Key.ENTER);

      await TestUtils.waitForSuccess(
        () => GUISelectors.getThreadMessageByText(view, "No matches found"), // Defined in extensions/vscode/e2e/test-continue/config.json's TOOL MOCK LLM that we are calling the exact search tool
      );
    });
  });

  describe("Chat Paths", () => {
    it("Open chat and type → open history → cmd+l → chat opens, empty and in focus", async () => {
      const originalTextInput = await GUISelectors.getMessageInputFieldAtIndex(
        view,
        0,
      );
      await originalTextInput.click();
      await originalTextInput.sendKeys("Hello");
      expect(await originalTextInput.getText()).to.equal("Hello");

      await view.switchBack();

      await (await GUISelectors.getHistoryNavButton(view)).click();
      await GUIActions.switchToReactIframe();

      await view.switchBack();
      await (await GUISelectors.getNewSessionNavButton(view)).click();
      await GUIActions.switchToReactIframe();

      const newTextInput = await TestUtils.waitForSuccess(() =>
        GUISelectors.getMessageInputFieldAtIndex(view, 0),
      );
      const activeElement: WebElement = await driver.switchTo().activeElement();
      const newTextInputHtml = await newTextInput.getAttribute("outerHTML");
      const activeElementHtml = await activeElement.getAttribute("outerHTML");
      expect(newTextInputHtml).to.equal(activeElementHtml);

      const textInputValue = await newTextInput.getText();
      expect(textInputValue).to.equal("");
    }).timeout(DEFAULT_TIMEOUT.XL);

    it("chat → history → chat", async () => {
      const messagePair1 = TestUtils.generateTestMessagePair(1);
      await GUIActions.sendMessage({
        view,
        message: messagePair1.userMessage,
        inputFieldIndex: 0,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, messagePair1.llmResponse),
      );

      const messagePair2 = TestUtils.generateTestMessagePair(2);
      await GUIActions.sendMessage({
        view,
        message: messagePair2.userMessage,
        inputFieldIndex: 1,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, messagePair2.llmResponse),
      );

      /**
       * SWITCHING BACK AND FORTH
       * We are switching back and forth here because the history is broken.
       * It only updates once a another chat is opened, so we need to open a
       * different chat first.
       */
      await view.switchBack();
      await (await GUISelectors.getHistoryNavButton(view)).click();
      await GUIActions.switchToReactIframe();

      await (await GUISelectors.getNthHistoryTableRow(view, 0)).click();

      await view.switchBack();
      await (await GUISelectors.getHistoryNavButton(view)).click();
      /**
       * END OF SWITCHING BACK AND FORTH
       */

      await GUIActions.switchToReactIframe();
      await (await GUISelectors.getNthHistoryTableRow(view, 0)).click();

      await GUISelectors.getThreadMessageByText(view, messagePair1.llmResponse);
      await GUISelectors.getThreadMessageByText(view, messagePair2.llmResponse);

      const messagePair3 = TestUtils.generateTestMessagePair(3);
      await GUIActions.sendMessage({
        view,
        message: messagePair3.userMessage,
        inputFieldIndex: 2,
      });
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, messagePair3.llmResponse),
      );
    }).timeout(DEFAULT_TIMEOUT.XL);
  });
});
