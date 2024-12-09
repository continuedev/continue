import {
  EditorView,
  WebView,
  WebDriver,
  VSBrowser,
  Key,
} from "vscode-extension-tester";
import { expect } from "chai";
import { GUIActions } from "../actions/GUI.actions";
import { GUISelectors } from "../selectors/GUI.selectors";
import * as path from "path";
import { TestUtils } from "../TestUtils";

const DEFAULT_TIMEOUT = 100000000;

describe("GUI Test", () => {
  let view: WebView;
  let driver: WebDriver;

  before(async function () {
    this.timeout(10000000);
    await VSBrowser.instance.openResources(path.join("e2e/test-continue"));
  });

  beforeEach(async function () {
    await GUIActions.openGui();

    view = new WebView();
    driver = view.getDriver();

    await GUIActions.switchToReactIframe(driver);
    await GUIActions.selectModelFromDropdown(view, "TEST LLM");

    // await new Promise((res) => {
    //   setTimeout(res, 10000000);
    // });
  });

  afterEach(async () => {
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
      const [tiptap] = await GUISelectors.getTipTapEditor(view);
      const messagePair = TestUtils.generateTestMessagePair();
      await tiptap.sendKeys(messagePair.userMessage);
      await tiptap.sendKeys(Key.ENTER);
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair.llmResponse),
      );
    });

    it("Can submit message by button click", async () => {
      const [tiptap] = await GUISelectors.getTipTapEditor(view);
      const messagePair = TestUtils.generateTestMessagePair();
      await tiptap.sendKeys(messagePair.userMessage);
      (await GUISelectors.getSubmitInputButton(view)).click();
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair.llmResponse),
      );
    });
  });

  describe("Chat Paths", () => {
    it("chat → history → chat", async () => {
      const [tiptap] = await GUISelectors.getTipTapEditor(view);

      const messagePair1 = TestUtils.generateTestMessagePair(1);
      await tiptap.sendKeys(messagePair1.userMessage);
      (await GUISelectors.getSubmitInputButton(view)).click();

      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair1.llmResponse),
      );

      const messagePair2 = TestUtils.generateTestMessagePair(2);
      await tiptap.sendKeys(messagePair2.userMessage);
      await tiptap.sendKeys(Key.ENTER);
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
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair1.llmResponse),
      );
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair2.llmResponse),
      );

      const [, , tiptapNew] = await GUISelectors.getTipTapEditor(view);
      const messagePair3 = TestUtils.generateTestMessagePair(3);
      await tiptapNew.sendKeys(messagePair3.userMessage);
      await tiptapNew.sendKeys(Key.ENTER);
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair1.llmResponse),
      );
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair2.llmResponse),
      );
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair3.llmResponse),
      );
    }).timeout(DEFAULT_TIMEOUT);

    it("message → edit message", async () => {
      const [tiptap] = await GUISelectors.getTipTapEditor(view);
      const messagePair2 = TestUtils.generateTestMessagePair(2);
      await tiptap.sendKeys(messagePair2.userMessage);
      await tiptap.sendKeys(Key.ENTER);
      await TestUtils.waitForElement(() =>
        GUISelectors.getThreadMessageByText(view, messagePair2.llmResponse),
      );
    });
  });
});
