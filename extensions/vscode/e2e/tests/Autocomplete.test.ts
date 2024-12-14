import {
  EditorView,
  TextEditor,
  InputBox,
  Workbench,
} from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "../constants";
import { GlobalActions } from "../actions/Global.actions";
import { AutocompleteActions } from "../actions/Autocomplete.actions";

describe("Autocomplete", () => {
  let editor: TextEditor;

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GlobalActions.openTestWorkspace();
    await new Workbench().executeCommand("Create: New File...");
    await (
      await InputBox.create(DEFAULT_TIMEOUT.MD)
    ).selectQuickPick("Text File");
    editor = (await new EditorView().openEditor("Untitled-1")) as TextEditor;
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    await editor.clearText();
    await new EditorView().closeAllEditors();
  });

  it("Should display completions", async () => {
    await AutocompleteActions.testCompletions(editor);
  }).timeout(DEFAULT_TIMEOUT.XL);
});
