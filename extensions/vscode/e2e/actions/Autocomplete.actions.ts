import { expect } from "chai";
import { TextEditor, VSBrowser, Workbench } from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { AutocompleteSelectors } from "../selectors/Autocomplete.selectors";
import { TestUtils } from "../TestUtils";

export class AutocompleteActions {
  public static async testCompletions(editor: TextEditor) {
    const driver = editor.getDriver();

    const messagePair0 = TestUtils.generateTestMessagePair(0);
    await editor.typeTextAt(1, 1, messagePair0.userMessage);
    await editor.typeTextAt(1, messagePair0.userMessage.length + 1, " ");
    const ghostText0 = await TestUtils.waitForSuccess(
      () => AutocompleteSelectors.getGhostTextContent(driver),
      // The first completion takes longer because Continue needs to load
      DEFAULT_TIMEOUT.XL,
    );
    expect(ghostText0).to.equal(messagePair0.llmResponse);

    await editor.clearText();

    const messagePair1 = TestUtils.generateTestMessagePair(1);
    await editor.typeTextAt(1, 1, messagePair1.userMessage);
    await editor.typeTextAt(1, messagePair1.userMessage.length + 1, " ");
    const ghostText1 = await TestUtils.waitForSuccess(() =>
      AutocompleteSelectors.getGhostTextContent(driver),
    );
    expect(ghostText1).to.equal(messagePair1.llmResponse);
  }

  public static async forceCompletion(editor: TextEditor): Promise<string> {
    await editor.setText("def main():\n    ");
    await editor.moveCursor(2, 5);

    await new Workbench().executeCommand("Continue: Force Autocomplete");

    const ghostText = await TestUtils.waitForSuccess(() =>
      AutocompleteSelectors.getGhostTextContent(VSBrowser.instance.driver),
    );

    return ghostText;
  }
}
