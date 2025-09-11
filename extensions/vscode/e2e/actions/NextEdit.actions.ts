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
    const editorText = await editor.getTextAtLine(2);

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

    return editorText === "def main():\n   s";
  }

  /**
   * Force a Next Edit suggestion using command.
   */
  public static async forceNextEdit(editor: TextEditor): Promise<boolean> {
    console.log("Starting forceNextEdit...");
    await editor.setText("def main():\n   s");
    console.log("Text set in editor");
    await editor.moveCursor(2, 4);
    console.log("Cursor moved to position 2, 4");

    await new Workbench().executeCommand("Continue: Force Next Edit");
    console.log("Executed 'Force Next Edit' command");

    // console.log("Waiting for SVG decoration to appear...");
    // await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.MD);
    // console.log("Wait completed, looking for decoration...");
    console.log("Looking for decoration...");

    const svgDecoration = await TestUtils.waitForSuccess(
      () => NextEditSelectors.getSvgDecoration(VSBrowser.instance.driver),
      DEFAULT_TIMEOUT.XL,
    );

    const result = svgDecoration !== null;
    console.log("SVG decoration search result:", result);
    return result;
  }

  public static async reload(): Promise<void> {
    await new Workbench().executeCommand("workbench.action.reloadWindow");
  }
}
