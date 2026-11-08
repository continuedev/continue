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
      ).selectQuickPick("Continuous");
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

  /**
   * @param requireDisplayed throw (so a caller can retry) unless the Continuous
   *   webview is actually showing, instead of falling back to a hidden one.
   */
  public static switchToReactIframe = async (
    opts: { requireDisplayed?: boolean } = {},
  ) => {
    const view = new WebView();
    const driver = view.getDriver();

    // The iframe is looked up from the top-level page, so this must work even
    // when the driver is currently inside a webview.
    await driver.switchTo().defaultContent();

    const iframes = await GUISelectors.getAllIframes(driver);
    let continueIFrame: WebElement | undefined = undefined;
    let firstMatch: WebElement | undefined = undefined;
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      const src = await iframe.getAttribute("src");
      if (src?.includes("extensionId=b1tninja.continuous")) {
        firstMatch ??= iframe;
        // Newer VS Code versions keep hidden webviews around, so prefer the
        // one that is actually showing.
        if (await iframe.isDisplayed()) {
          continueIFrame = iframe;
          break;
        }
      }
    }
    if (!continueIFrame && opts.requireDisplayed) {
      throw new Error("Continue iframe is not displayed yet");
    }
    continueIFrame ??= firstMatch;

    if (!continueIFrame) {
      throw new Error("Could not find Continue iframe");
    }

    await driver.switchTo().frame(continueIFrame);

    // The inner React iframe appears once the webview has loaded: wait for it
    // rather than sleeping for a fixed time.
    const reactIFrame = await TestUtils.waitForSuccess(
      () => GUISelectors.getReactIframe(driver),
      DEFAULT_TIMEOUT.SM,
      100,
    ).catch(() => undefined);

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
      new Workbench().executeCommand("continuous.focusContinuousInput"),
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
