import {
  InputBox,
  Key,
  WebDriver,
  WebElement,
  WebView,
  Workbench,
} from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

export class GUIActions {
  public static moveContinueToSidebar = async (driver: WebDriver) => {
    await GUIActions.toggleGui();
    await TestUtils.waitForSuccess(async () => {
      await new Workbench().executeCommand("View: Move View");
      await (
        await InputBox.create(DEFAULT_TIMEOUT.MD)
      ).selectQuickPick("Continue");
      await (
        await InputBox.create(DEFAULT_TIMEOUT.MD)
      ).selectQuickPick("New Secondary Side Bar Entry");
    });

    // first call focuses the input
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await GUIActions.executeFocusContinueInputShortcut(driver);

    // second call closes the gui
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XS);
    await GUIActions.executeFocusContinueInputShortcut(driver);
  };

  public static switchToReactIframe = async () => {
    const view = new WebView();
    const driver = view.getDriver();

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
      throw new Error("Could not find Continue iframe");
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
    return {
      view,
      driver,
    };
  };

  public static toggleGui = async () => {
    return TestUtils.waitForSuccess(() =>
      new Workbench().executeCommand("continue.focusContinueInput"),
    );
  };

  public static selectModelFromDropdown = async (
    view: WebView,
    option: string,
  ) => {
    const dropdownButton = await GUISelectors.getModelDropdownButton(view);
    await dropdownButton.click();

    const dropdownOption = await TestUtils.waitForSuccess(() => {
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

  public static async executeFocusContinueInputShortcut(driver: WebDriver) {
    return driver
      .actions()
      .keyDown(TestUtils.osControlKey)
      .sendKeys("l")
      .keyUp(TestUtils.osControlKey)
      .perform();
  }
}
