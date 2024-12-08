import {
  EditorView,
  WebView,
  WebDriver,
  VSBrowser,
} from "vscode-extension-tester";
import { expect } from "chai";
import { GUIActions } from "../actions/GUI.actions";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

describe("GUI Test", () => {
  let view: WebView;
  let driver: WebDriver;

  before(async function () {
    this.timeout(10000000);

    await VSBrowser.instance.openResources("e2e/test-continue");

    await GUIActions.openGui();

    view = new WebView();
    driver = view.getDriver();

    await GUIActions.switchToReactIframe(driver);
    // await new Promise((res) => {
    //   setTimeout(res, 10000000);
    // });
  });

  after(async () => {
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  it("should display correct panel description", async () => {
    const description = await GUISelectors.getDescription(view);

    expect(await description.getText()).has.string(
      "Quickly get up and running using our API keys.",
    );
  }).timeout(20_000);

  it("should allow typing text in the editor", async () => {
    await GUIActions.selectModelFromDropdown(view, "Mock");
    await GUIActions.selectModelFromDropdown(view, "TEST LLM");

    const tiptap = await GUISelectors.getTipTapEditor(view);

    await tiptap.sendKeys("How are you?");
    (await GUISelectors.getSubmitInputButton(view)).click();

    await TestUtils.waitForElement(() =>
      GUISelectors.getThreadMessageByText(view, "I'm fine"),
    );
  }).timeout(20_000);
});
