import {
  Workbench,
  EditorView,
  WebView,
  By,
  WebElement,
  WebDriver,
  Key,
} from "vscode-extension-tester";
import { expect } from "chai";

const switchToReactIframe = async (driver: WebDriver) => {
  const iframes = await driver.findElements(By.css("iframe"));
  let continueIFrame: WebElement | undefined = undefined;
  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i];
    const src = await iframe.getAttribute("src");
    if (src.includes("extensionId=Continue.continue")) {
      continueIFrame = iframe;
      break;
    }
  }

  if (!continueIFrame) {
    throw new Error("Could not find continue iframe");
  }

  await driver.switchTo().frame(continueIFrame);

  await new Promise((res) => {
    setTimeout(res, 500);
  });

  const reactIFrame = await driver.findElement(By.css("iframe"));

  if (!reactIFrame) {
    throw new Error("Could not find React iframe");
  }

  await driver.switchTo().frame(reactIFrame);
};

describe("GUI Test", () => {
  let view: WebView;
  let driver: WebDriver;

  before(async function () {
    this.timeout(10000);

    await new Workbench().executeCommand("continue.focusContinueInput");

    view = new WebView();
    driver = view.getDriver();

    await switchToReactIframe(driver);
  });

  after(async () => {
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  it("should display correct panel description", async () => {
    const description = await view.findWebElement(
      By.xpath("//*[contains(text(), 'Quickly')]"),
    );

    expect(await description.getText()).has.string(
      "Quickly get up and running using our API keys.",
    );
  });

  it("should allow typing text in the editor", async () => {
    const tiptap = await view.findWebElement(By.className("tiptap"));

    await tiptap.sendKeys("Hello world!");

    expect(await tiptap.getText()).has.string("Hello world!");

    // Just to show that we can
    await tiptap.sendKeys(Key.ENTER);
    await new Promise((res) => {
      setTimeout(res, 5000);
    });
  }).timeout(6000);
});
