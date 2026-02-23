import { Key, TextEditor, WebElement } from "vscode-extension-tester";

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

  /**
   * Types each string in the array with a newline (Shift+Enter) between them.
   * Optionally adds a final Enter key press to submit.
   */
  public static async typeWithNewlines({
    input,
    lines,
    submit,
  }: {
    input: TextEditor | WebElement;
    lines: string[];
    submit?: boolean;
  }) {
    for (let i = 0; i < lines.length - 1; i++) {
      await input.sendKeys(lines[i]);
      await input.sendKeys(Key.chord(Key.SHIFT, Key.ENTER));
    }
    await input.sendKeys(lines[lines.length - 1]);
    if (submit) {
      await input.sendKeys(Key.ENTER);
    }
  }
}
