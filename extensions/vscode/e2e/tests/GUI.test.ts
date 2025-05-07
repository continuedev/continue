import { expect } from "chai";
import {
  By,
  EditorView,
  Key,
  VSBrowser,
  WebDriver,
  WebElement,
  WebView,
  until,
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
    // Uncomment this line for faster testing
    await GUIActions.moveContinueToSidebar(VSBrowser.instance.driver);
    await GlobalActions.openTestWorkspace();
    await GlobalActions.clearAllNotifications();
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
    it.skip("should display correct panel description", async () => {
      const description = await GUISelectors.getDescription(view);

      expect(await description.getText()).has.string(
        "Log in to quickly build your first custom AI code assistant",
      );
    }).timeout(DEFAULT_TIMEOUT.XL);

    // We no longer have a quick start button
    it.skip(
      "should display tutorial card after accepting onboarding quick start",
      async () => {
        // Get paragraph with text Best
        const bestTab = await GUISelectors.getOnboardingTabButton(view, "Best");
        await bestTab.click();

        const anthropicInput = await TestUtils.waitForSuccess(
          async () => await GUISelectors.getBestChatApiKeyInput(view),
        );
        anthropicInput.sendKeys("invalid_api_key");

        const mistralInput =
          await GUISelectors.getBestAutocompleteApiKeyInput(view);
        mistralInput.sendKeys("invalid_api_key");

        // Get button with text "Connect" and click it
        const connectButton = await view.findWebElement(
          By.xpath("//button[text()='Connect']"),
        );
        await connectButton.click();

        await TestUtils.waitForSuccess(
          async () => await GUISelectors.getTutorialCard(view),
        );

        // TODO validate that claude has been added to list

        // Skip testing Quick Start because github auth opens external app and breaks test
        // const quickStartButton = await view.findWebElement(
        //   By.xpath("//*[contains(text(), 'Get started using our API keys')]")
        // );
        // await quickStartButton.click();
        // await view.switchBack();
        // const allowButton = await TestUtils.waitForSuccess(
        //   async () => await driver.findElement(By.xpath(`//a[contains(text(), "Allow")]`))
        // );
        // await allowButton.click();
        // ({ view, driver } = await GUIActions.switchToReactIframe());
      },
    ).timeout(DEFAULT_TIMEOUT.XL);
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

  describe("Agent with tools", () => {
    it("should render tool call", async () => {
      await GUIActions.selectModelFromDropdown(view, "TOOL MOCK LLM");
      await GUIActions.selectModeFromDropdown(view, "Agent");

      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      await messageInput.sendKeys("Hello");
      await messageInput.sendKeys(Key.ENTER);

      const statusMessage = await TestUtils.waitForSuccess(
        () => GUISelectors.getToolCallStatusMessage(view), // Defined in extensions/vscode/e2e/test-continue/config.json's TOOL MOCK LLM that we are calling the exact search tool
        DEFAULT_TIMEOUT.SM,
      );

      expect(await statusMessage.getText()).contain(
        "Continue viewed the git diff",
      );
    }).timeout(DEFAULT_TIMEOUT.MD);

    it("should call tool after approval", async () => {
      await GUIActions.toggleToolPolicy(view, "builtin_view_diff", 2);

      await TestUtils.waitForSuccess(() =>
        GUIActions.selectModelFromDropdown(view, "TOOL MOCK LLM"),
      );

      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      await messageInput.sendKeys("Hello");
      await messageInput.sendKeys(Key.ENTER);

      const acceptToolCallButton = await TestUtils.waitForSuccess(() =>
        GUISelectors.getAcceptToolCallButton(view),
      );
      await acceptToolCallButton.click();

      const statusMessage = await TestUtils.waitForSuccess(
        () => GUISelectors.getToolCallStatusMessage(view), // Defined in extensions/vscode/e2e/test-continue/config.json's TOOL MOCK LLM that we are calling the exact search tool
        DEFAULT_TIMEOUT.SM,
      );

      const text = await statusMessage.getText();
      expect(text).contain("the git diff");
    }).timeout(DEFAULT_TIMEOUT.XL);

    it("should cancel tool", async () => {
      await GUIActions.toggleToolPolicy(view, "builtin_view_diff", 2);

      await TestUtils.waitForSuccess(() =>
        GUIActions.selectModelFromDropdown(view, "TOOL MOCK LLM"),
      );

      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      await messageInput.sendKeys("Hello");
      await messageInput.sendKeys(Key.ENTER);

      const cancelToolCallButton = await TestUtils.waitForSuccess(() =>
        GUISelectors.getRejectToolCallButton(view),
      );
      await cancelToolCallButton.click();

      const statusMessage = await TestUtils.waitForSuccess(
        () => GUISelectors.getToolCallStatusMessage(view), // Defined in extensions/vscode/e2e/test-continue/config.json's TOOL MOCK LLM that we are calling the exact search tool
        DEFAULT_TIMEOUT.SM,
      );

      const text = await statusMessage.getText();
      expect(text).contain("Continue tried to view the git diff");
    }).timeout(DEFAULT_TIMEOUT.XL);
  });

  describe("Context providers", () => {
    it("should successfully use the terminal context provider", async () => {
      await GUIActions.selectModelFromDropdown(view, "LAST MESSAGE MOCK LLM");

      // Enter just the context provider in the input and send
      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      await messageInput.sendKeys("@");
      await messageInput.sendKeys("terminal");
      await messageInput.sendKeys(Key.ENTER);
      await messageInput.sendKeys(Key.ENTER);

      // Open the context items peek
      const contextItemsPeek = await GUISelectors.getContextItemsPeek(view);
      await contextItemsPeek.click();

      await TestUtils.waitForSuccess(async () => {
        const firstContextItemInPeek =
          await GUISelectors.getFirstContextItemsPeekItem(view);
        await firstContextItemInPeek.click();

        // Check that item is there with correct name
        const description = await firstContextItemInPeek.getText();
        expect(description).to.include("Terminal");
      });

      // Check that the contents match what we expect (repeated back by the mock LLM)
      await TestUtils.waitForSuccess(() => {
        return GUISelectors.getThreadMessageByText(
          view,
          "Current terminal contents:",
        );
      });
    }).timeout(DEFAULT_TIMEOUT.MD);
  });

  describe("Repeat back the system message", () => {
    it("should repeat back the system message", async () => {
      await GUIActions.selectModelFromDropdown(view, "SYSTEM MESSAGE MOCK LLM");
      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      await messageInput.sendKeys("Hello");
      await messageInput.sendKeys(Key.ENTER);
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, "TEST_SYS_MSG"),
      );
    });
  });

  describe("Chat Paths", () => {
    it("Send many messages → chat auto scrolls → go to history → open previous chat → it is scrolled to the bottom", async () => {
      for (let i = 0; i <= 20; i++) {
        const { userMessage, llmResponse } =
          TestUtils.generateTestMessagePair(i);
        await GUIActions.sendMessage({
          view,
          message: userMessage,
          inputFieldIndex: i,
        });
        const response = await TestUtils.waitForSuccess(() =>
          GUISelectors.getThreadMessageByText(view, llmResponse),
        );

        const viewportHeight = await driver.executeScript(
          "return window.innerHeight",
        );

        const isInViewport = await driver.executeScript(
          `
          const rect = arguments[0].getBoundingClientRect();
          return (
            rect.top >= 0 &&
            rect.bottom <= ${viewportHeight}
          );
          `,
          response,
        );

        expect(isInViewport).to.eq(true);
      }

      await view.switchBack();

      await (await GUISelectors.getHistoryNavButton(view)).click();
      await GUIActions.switchToReactIframe();
      TestUtils.waitForSuccess(async () => {
        await (await GUISelectors.getNthHistoryTableRow(view, 0)).click();
      });

      const { llmResponse } = TestUtils.generateTestMessagePair(20);
      const response = await TestUtils.waitForSuccess(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse),
      );

      const viewportHeight = await driver.executeScript(
        "return window.innerHeight",
      );

      const isInViewport = await driver.executeScript(
        `
        const rect = arguments[0].getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.bottom <= ${viewportHeight}
        );
        `,
        response,
      );

      expect(isInViewport).to.eq(true);
    }).timeout(DEFAULT_TIMEOUT.XL * 1000);

    it("Open chat and send message → press arrow up and arrow down to cycle through messages → submit another message → press arrow up and arrow down to cycle through messages", async () => {
      await GUIActions.sendMessage({
        view,
        message: "MESSAGE 1",
        inputFieldIndex: 0,
      });

      const input1 = await TestUtils.waitForSuccess(async () => {
        return GUISelectors.getMessageInputFieldAtIndex(view, 1);
      });
      expect(await input1.getText()).to.equal("");

      await input1.sendKeys(Key.ARROW_UP);
      await driver.wait(
        until.elementTextIs(input1, "MESSAGE 1"),
        DEFAULT_TIMEOUT.SM,
      );

      await input1.sendKeys(Key.ARROW_DOWN); // First press - bring caret to the end of the message
      await input1.sendKeys(Key.ARROW_DOWN); // Second press - trigger message change
      await driver.wait(until.elementTextIs(input1, ""), DEFAULT_TIMEOUT.SM);

      await GUIActions.sendMessage({
        view,
        message: "MESSAGE 2",
        inputFieldIndex: 1,
      });

      const input2 = await TestUtils.waitForSuccess(async () => {
        return GUISelectors.getMessageInputFieldAtIndex(view, 2);
      });
      expect(await input2.getText()).to.equal("");

      await input2.sendKeys(Key.ARROW_UP);
      await driver.wait(
        until.elementTextIs(input2, "MESSAGE 2"),
        DEFAULT_TIMEOUT.SM,
      );

      await input2.sendKeys(Key.ARROW_UP);
      await driver.wait(
        until.elementTextIs(input2, "MESSAGE 1"),
        DEFAULT_TIMEOUT.SM,
      );

      await input2.sendKeys(Key.ARROW_DOWN); // First press - bring caret to the end of the message
      await input2.sendKeys(Key.ARROW_DOWN); // Second press - trigger message change
      await driver.wait(
        until.elementTextIs(input2, "MESSAGE 2"),
        DEFAULT_TIMEOUT.SM,
      );

      await input2.sendKeys(Key.ARROW_DOWN);
      await driver.wait(until.elementTextIs(input2, ""), DEFAULT_TIMEOUT.SM);
    }).timeout(DEFAULT_TIMEOUT.XL);

    it("Open chat and type → open history → press new session button → chat opens, empty and in focus", async () => {
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
