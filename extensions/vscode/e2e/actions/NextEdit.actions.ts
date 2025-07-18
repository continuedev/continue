import { expect } from "chai";
import { TextEditor, VSBrowser, Workbench } from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { NextEditSelectors } from "../selectors/NextEdit.selectors";
import { TestUtils } from "../TestUtils";

export class NextEditActions {
  /**
   * Test accepting a Next Edit suggestion with Tab.
   */
  public static async acceptNextEditSuggestion(editor: TextEditor) {
    const hasDecoration = await NextEditActions.forceNextEdit(editor);
    expect(hasDecoration).to.be.true;

    await new Workbench().executeCommand(
      "Continue: Accept Next Edit Suggestion",
    );

    // Check if HELLO is written into the editor.
    const editorText = await editor.getTextAtLine(1);

    return editorText === "HELLO";
  }

  /**
   * Test rejecting a Next Edit suggestion with Esc.
   */
  public static async rejectNextEditSuggestion(editor: TextEditor) {
    const hasDecoration = await NextEditActions.forceNextEdit(editor);
    expect(hasDecoration).to.be.true;

    await new Workbench().executeCommand("Continue: Hide Next Edit Suggestion");

    // Check if the editor text didn't change.
    const editorText = await editor.getText();

    return editorText === "def main():\n    ";
  }

  /**
   * Force a Next Edit suggestion using command.
   */
  public static async forceNextEdit(editor: TextEditor): Promise<boolean> {
    await editor.setText("def main():\n    ");
    await editor.moveCursor(2, 4);

    await new Workbench().executeCommand("Continue: Force Next Edit");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.XL);

    const svgDecoration = await TestUtils.waitForSuccess(
      () => NextEditSelectors.getSvgDecoration(VSBrowser.instance.driver),
      DEFAULT_TIMEOUT.XL,
    );

    return svgDecoration !== null;
  }

  public static async reload(): Promise<void> {
    await new Workbench().executeCommand("workbench.action.reloadWindow");
  }
}
