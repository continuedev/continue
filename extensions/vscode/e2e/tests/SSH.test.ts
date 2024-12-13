import {
  EditorView,
  TextEditor,
  InputBox,
  Workbench,
  VSBrowser,
  Key,
} from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { TestUtils } from "../TestUtils";
import { SSHSelectors } from "../selectors/SSH.selectors";
import { AutocompleteActions } from "../actions/Autocomplete.actions";
import * as path from "path";

describe("SSH", function () {
  this.retries(2); // Retries failed tests up to 2 times

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT);

    await new Workbench().executeCommand(
      "Remote-SSH: Connect Current Window to Host...",
    );
    await (
      await InputBox.create(DEFAULT_TIMEOUT)
    ).selectQuickPick("ssh-test-container");

    await TestUtils.waitForSuccess(
      () => SSHSelectors.connectedToRemoteConfirmationMessage(),
      DEFAULT_TIMEOUT,
    );

    await TestUtils.waitForSuccess(async () => {
      await new Workbench().executeCommand("File: Open Folder...");
      const inputBox = await InputBox.create(DEFAULT_TIMEOUT);
      await inputBox.setText("/home/ec2-user/test-folder");
      await inputBox.confirm();
    }, DEFAULT_TIMEOUT);

    await TestUtils.waitForSuccess(async () => {
      await new Workbench().executeCommand("File: Open File...");
      const inputBox = await InputBox.create(DEFAULT_TIMEOUT);
      await inputBox.setText("/home/ec2-user/test-folder/main.py");
      await inputBox.selectQuickPick("main.py");
      await inputBox.sendKeys(Key.ENTER);
    }, DEFAULT_TIMEOUT);
  });

  it("Should display completions", async () => {
    const editor = await TestUtils.waitForSuccess(
      async () => (await new EditorView().openEditor("main.py")) as TextEditor,
      DEFAULT_TIMEOUT,
    );

    await editor.clearText();
    await AutocompleteActions.testCompletions(editor);
  }).timeout(DEFAULT_TIMEOUT);
});
