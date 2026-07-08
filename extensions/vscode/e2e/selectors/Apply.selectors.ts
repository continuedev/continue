import { WebView } from "vscode-extension-tester";

import { SelectorUtils } from "./SelectorUtils";

export class ApplySelectors {
  static getCodeblockToolbarAction(
    view: WebView,
    action: "apply" | "accept" | "reject" | "create",
  ) {
    return SelectorUtils.getElementByDataTestId(
      view,
      `codeblock-toolbar-${action}`,
    );
  }
}
