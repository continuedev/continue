import { WebDriver } from "vscode-extension-tester";

import { TestUtils } from "../TestUtils";

export class KeyboardShortcutsActions {
  public static async executeFocusContinueInput(driver: WebDriver) {
    return await driver
      .actions()
      .keyDown(TestUtils.osControlKey)
      .sendKeys("l")
      .keyUp(TestUtils.osControlKey)
      .perform();
  }
}
