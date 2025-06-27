import { TextEditor, VSBrowser, Workbench } from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { NextEditSelectors } from "../selectors/NextEdit.selectors";
import { TestUtils } from "../TestUtils";

export class NextEditActions {
  /**
   * Force a Next Edit suggestion using command.
   */
  public static async forceNextEdit(editor: TextEditor): Promise<boolean> {
    await editor.setText("def main():\n    ");
    await editor.moveCursor(2, 4);

    await new Workbench().executeCommand("Continue: Force Next Edit");
    await TestUtils.waitForTimeout(DEFAULT_TIMEOUT.MD);

    const svgDecoration = await TestUtils.waitForSuccess(
      () => NextEditSelectors.getSvgDecoration(VSBrowser.instance.driver),
      DEFAULT_TIMEOUT.XL
    );
    
    return svgDecoration !== null;
  }
}
