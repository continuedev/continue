import { EditorView, WebView, WebDriver, Key } from "vscode-extension-tester";
import { expect } from "chai";
import { GUIActions } from "../actions/GUI.actions";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";
import { DEFAULT_TIMEOUT } from "../constants";
import { GlobalActions } from "../actions/Global.actions";

describe("GUI Test", () => {
  let view: WebView;
  let driver: WebDriver;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT);
    await GlobalActions.openTestWorkspace();
  });

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT);

    await GUIActions.openGui();

    view = new WebView();
    driver = view.getDriver();

    await GUIActions.switchToReactIframe(driver);
    await GUIActions.selectModelFromDropdown(view, "TEST LLM");

    // await new Promise((res) => {
    //   setTimeout(res, DEFAULT_TIMEOUT);
    // });
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT);

    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  describe("Onboarding", () => {
    it("should display correct panel description", async () => {
      const description = await GUISelectors.getDescription(view);

      expect(await description.getText()).has.string(
        "Quickly get up and running using our API keys.",
      );
    }).timeout(DEFAULT_TIMEOUT);
  });

  describe("Chat", () => {
    it("Can submit message by pressing enter", async () => {
      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      const messagePair = TestUtils.generateTestMessagePair();
      await messageInput.sendKeys(messagePair.userMessage);
      await messageInput.sendKeys(Key.ENTER);
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair.llmResponse),
      );
    });

    it("Can submit message by button click", async () => {
      const [messageInput] = await GUISelectors.getMessageInputFields(view);
      const messagePair = TestUtils.generateTestMessagePair();
      await messageInput.sendKeys(messagePair.userMessage);
      (await GUISelectors.getSubmitInputButton(view)).click();
      await TestUtils.waitForElement(() =>
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
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse0),
      );

      const { userMessage: userMessage1, llmResponse: llmResponse1 } =
        TestUtils.generateTestMessagePair(1);
      await GUIActions.sendMessage({
        view,
        message: userMessage1,
        inputFieldIndex: 1,
      });
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse1),
      );

      const { userMessage: userMessage2, llmResponse: llmResponse2 } =
        TestUtils.generateTestMessagePair(2);
      await GUIActions.sendMessage({
        view,
        message: userMessage2,
        inputFieldIndex: 2,
      });
      await TestUtils.waitForElement(() =>
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
    }).timeout(DEFAULT_TIMEOUT);

    it("Can edit messages", async () => {
      const { userMessage: userMessage0, llmResponse: llmResponse0 } =
        TestUtils.generateTestMessagePair(0);
      await GUIActions.sendMessage({
        view,
        message: userMessage0,
        inputFieldIndex: 0,
      });
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse0),
      );

      const { userMessage: userMessage1, llmResponse: llmResponse1 } =
        TestUtils.generateTestMessagePair(1);
      await GUIActions.sendMessage({
        view,
        message: userMessage1,
        inputFieldIndex: 1,
      });
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, llmResponse1),
      );

      const { userMessage: userMessage2, llmResponse: llmResponse2 } =
        TestUtils.generateTestMessagePair(2);
      await GUIActions.sendMessage({
        view,
        message: userMessage2,
        inputFieldIndex: 2,
      });
      await TestUtils.waitForElement(() =>
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

      await TestUtils.waitForElement(() =>
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
    }).timeout(DEFAULT_TIMEOUT);
  });

  describe("Chat Paths", () => {
    it("chat → history → chat", async () => {
      const messagePair1 = TestUtils.generateTestMessagePair(1);
      await GUIActions.sendMessage({
        view,
        message: messagePair1.userMessage,
        inputFieldIndex: 0,
      });
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair1.llmResponse),
      );

      const messagePair2 = TestUtils.generateTestMessagePair(2);
      await GUIActions.sendMessage({
        view,
        message: messagePair2.userMessage,
        inputFieldIndex: 1,
      });
      await TestUtils.waitForElement(() =>
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
      await GUIActions.switchToReactIframe(driver);

      await (await GUISelectors.getNthHistoryTableRow(view, 0)).click();

      await view.switchBack();
      await (await GUISelectors.getHistoryNavButton(view)).click();
      /**
       * END OF SWITCHING BACK AND FORTH
       */

      await GUIActions.switchToReactIframe(driver);
      await (await GUISelectors.getNthHistoryTableRow(view, 0)).click();

      await GUISelectors.getThreadMessageByText(view, messagePair1.llmResponse);
      await GUISelectors.getThreadMessageByText(view, messagePair2.llmResponse);

      const messagePair3 = TestUtils.generateTestMessagePair(3);
      await GUIActions.sendMessage({
        view,
        message: messagePair3.userMessage,
        inputFieldIndex: 2,
      });
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair3.llmResponse),
      );
    }).timeout(DEFAULT_TIMEOUT);
  });
});
