import {
  Key,
  WebDriver,
  WebElement,
  WebView,
  Workbench,
} from "vscode-extension-tester";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

export class GUIActions {
  public static switchToReactIframe = async (driver: WebDriver) => {
    const iframes = await GUISelectors.getAllIframes(driver);
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

    const reactIFrame = await GUISelectors.getReactIframe(driver);

    if (!reactIFrame) {
      throw new Error("Could not find React iframe");
    }

    await driver.switchTo().frame(reactIFrame);
  };

  public static openGui = async () => {
    return new Workbench().executeCommand("continue.focusContinueInput");
  };

  public static selectModelFromDropdown = async (
    view: WebView,
    option: string,
  ) => {
    const dropdownButton = await GUISelectors.getModelDropdownButton(view);
    await dropdownButton.click();

    const dropdownOption = await TestUtils.waitForElement(() => {
      return GUISelectors.getModelDropdownOption(view, option);
    });

    await dropdownOption.click();
  };

  public static async sendMessage({
    view,
    message,
    inputFieldIndex,
  }: {
    view: WebView;
    message: string;
    inputFieldIndex: number;
  }) {
    const editor = await GUISelectors.getMessageInputFieldAtIndex(
      view,
      inputFieldIndex,
    );
    await editor.sendKeys(message);
    await editor.sendKeys(Key.ENTER);
  }
}
