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

  public static selectModeFromDropdown = async (
    view: WebView,
    option: string,
  ) => {
    const dropdownButton = await GUISelectors.getModeDropdownButton(view);
    await dropdownButton.click();

    const dropdownOption = await TestUtils.waitForSuccess(() => {
      return GUISelectors.getModeDropdownOption(view, option);
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

  public static async toggleToolPolicy(
    view: WebView,
    toolName: string,
    desiredState: number | string,
  ) {
    // Navigate to config page

    const settingsButton = await TestUtils.waitForSuccess(() =>
      GUISelectors.getSettingsNavButton(view),
    );
    await settingsButton.click();
    await TestUtils.waitForTimeout(500);

    // Click on tools tab
    const toolsTab = await TestUtils.waitForSuccess(() =>
      GUISelectors.getToolsTab(view),
    );
    await toolsTab.click();
    await TestUtils.waitForTimeout(500);

    // Find and click the tool policy button
    const toolPolicyButton = await TestUtils.waitForSuccess(() =>
      GUISelectors.getToolPolicyButton(view, toolName),
    );
    await TestUtils.waitForTimeout(500);

    // Map old number format to state names for backward compatibility
    // 0 = Automatic/Auto, 1 = Excluded/Off, 2 = Ask First/Ask
    let targetStates: string[];
    if (typeof desiredState === "number") {
      const stateMap = [
        ["Automatic", "Auto"], // 0
        ["Excluded", "Off"], // 1
        ["Ask First", "Ask"], // 2
      ];
      targetStates = stateMap[desiredState] || ["Ask First", "Ask"];
    } else {
      targetStates = [desiredState];
    }

    // Keep clicking until we reach the desired state
    let maxAttempts = 5; // Safety limit to prevent infinite loops
    while (maxAttempts > 0) {
      const currentText = await toolPolicyButton.getText();

      // Check if we've reached any of the target states
      if (targetStates.some((state) => currentText.includes(state))) {
        break;
      }

      // Click to move to next state
      await toolPolicyButton.click();
      await TestUtils.waitForTimeout(200); // Small delay for UI update

      maxAttempts--;
    }

    if (maxAttempts === 0) {
      throw new Error(
        `Failed to set tool policy to ${targetStates.join(" or ")} after 5 attempts`,
      );
    }

    // Navigate back to chat
    const backButton = await TestUtils.waitForSuccess(() =>
      GUISelectors.getBackButton(view),
    );
    await backButton.click();
    await TestUtils.waitForTimeout(500);
  }
}
