import { TextEditor, WebView } from "vscode-extension-tester";

import { EditSelectors } from "../selectors/Edit.selectors";
import { TestUtils } from "../TestUtils";

export class EditActions {
  static async invokeEditShortcut(editor: TextEditor) {
    editor
      .getDriver()
      .actions()
      .keyDown(TestUtils.osControlKey)
      .sendKeys("i")
      .keyUp(TestUtils.osControlKey)
      .perform();
  }

  static async acceptEditInGUI(view: WebView): Promise<void> {
    await TestUtils.waitForSuccess(async () =>
      (await EditSelectors.getEditAcceptButton(view)).click(),
    );
    await view.switchBack();
  }

  static async rejectEditInGUI(view: WebView): Promise<void> {
    await TestUtils.waitForSuccess(async () =>
      (await EditSelectors.getEditRejectButton(view)).click(),
    );
    await view.switchBack();
  }

  static async acceptEditWithCodeLens(editor: TextEditor): Promise<void> {
    const acceptCodeLens = await editor.getCodeLens("Accept");
    await acceptCodeLens?.click();
  }

  static async rejectEditWithCodeLens(editor: TextEditor): Promise<void> {
    const rejectCodeLens = await editor.getCodeLens("Reject");
    await rejectCodeLens?.click();
  }
}
