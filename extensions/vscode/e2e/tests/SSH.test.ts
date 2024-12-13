import {
  EditorView,
  TextEditor,
  InputBox,
  Workbench,
} from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { TestUtils } from "../TestUtils";
import { SSHSelectors } from "../selectors/SSH.selectors";
import { AutocompleteActions } from "../actions/Autocomplete.actions";

describe("SSH", function () {
  this.retries(2); // Retries failed tests up to 2 times

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT);

    await new Workbench().executeCommand(
      "Remote-SSH: Connect Current Window to Host...",
    );
    await (await InputBox.create()).selectQuickPick("ssh-test-container");

    await TestUtils.waitForElement(
      () => SSHSelectors.connectedToRemoteConfirmationMessage(),
      DEFAULT_TIMEOUT,
    );

    await new Promise((res) => {
      setTimeout(res, 1000);
    });

    await new Workbench().executeCommand("File: Open Folder...");
    await new Promise((res) => {
      setTimeout(res, 4000);
    });

    const inputBox = await TestUtils.waitForElement(
      () => InputBox.create(),
      DEFAULT_TIMEOUT,
    );
    await inputBox.selectQuickPick("test-folder");
    await new Promise((res) => {
      setTimeout(res, 4000);
    });
    await inputBox.confirm();

    await new Promise((res) => {
      setTimeout(res, 4000);
    });

    await new Workbench().executeCommand("File: Open File...");
    await (await InputBox.create(5000)).selectQuickPick("main.py");
    await new Promise((res) => {
      setTimeout(res, 4000);
    });
  });

  it("Should display completions", async () => {
    const editor = (await new EditorView().openEditor("main.py")) as TextEditor;
    await editor.clearText();
    await AutocompleteActions.testCompletions(editor);
    // await new Promise((res) => {
    //   setTimeout(res, DEFAULT_TIMEOUT);
    // });
  }).timeout(DEFAULT_TIMEOUT);
});
