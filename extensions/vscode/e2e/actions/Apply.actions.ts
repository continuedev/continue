import { WebView } from "vscode-extension-tester";

import { ApplySelectors } from "../selectors/Apply.selectors";
import { TestUtils } from "../TestUtils";

export class ApplyActions {
  static async performAction(
    view: WebView,
    action: "apply" | "accept" | "reject" | "create",
  ) {
    let applyButton = await TestUtils.waitForSuccess(
      async () => await ApplySelectors.getCodeblockToolbarAction(view, action),
    );
    applyButton.click();
  }
}
