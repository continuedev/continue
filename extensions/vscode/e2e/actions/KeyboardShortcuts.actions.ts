import { TextEditor, WebDriver, WebView } from "vscode-extension-tester";

import { TestUtils } from "../TestUtils";

export class KeyboardShortcutsActions {
  /**
   * For some reason Selenium-simulated keyboard shortcuts don't perfectly
   * mimic the behavior of real shortcuts unless some text is highlighted first.
   */
  public static async HACK__typeWithSelect(editor: TextEditor, text: string) {
    await editor.typeText(text);
    await editor.selectText(text);
    await editor.typeText(text);
  }
}
