import {
  EditorView,
  InputBox,
  Key,
  TextEditor,
  Workbench,
} from "vscode-extension-tester";

import { AutocompleteActions } from "../actions/Autocomplete.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { SSHSelectors } from "../selectors/SSH.selectors";
import { TestUtils } from "../TestUtils";

describe("SSH", function () {
  if (process.env.IGNORE_SSH_TESTS === "true") {
    it("Skipping SSH tests", () => {
      console.log("Skipping SSH tests due to IGNORE_SSH_TESTS being set");
    });
    return;
  }

  it("Should display completions", async () => {
    await TestUtils.waitForSuccess(async () => {
      await new Workbench().executeCommand(
        "Remote-SSH: Connect Current Window to Host...",
      );
      await (
        await InputBox.create(DEFAULT_TIMEOUT.MD)
      ).selectQuickPick("ssh-test-container");
    });

    await TestUtils.waitForSuccess(
      () => SSHSelectors.connectedToRemoteConfirmationMessage(),
      DEFAULT_TIMEOUT.MD,
    );

    await TestUtils.waitForSuccess(async () => {
      await new Workbench().executeCommand("File: Open File...");
      const inputBox = await InputBox.create(DEFAULT_TIMEOUT.MD);
      await inputBox.setText("/home/ec2-user/test-folder/main.py");
      await inputBox.selectQuickPick("main.py");
      await inputBox.sendKeys(Key.ENTER);
    }, DEFAULT_TIMEOUT.MD);

    const editor = await TestUtils.waitForSuccess(
      async () => (await new EditorView().openEditor("main.py")) as TextEditor,
    );

    const text = await editor.getText();
    await editor.clearText();
    await AutocompleteActions.testCompletions(editor);
    await editor.setText(text);
  })
    .timeout(DEFAULT_TIMEOUT.XL)
    .retries(4);
});
