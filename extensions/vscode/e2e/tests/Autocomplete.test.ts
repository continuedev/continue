import { expect } from "chai";
import { EditorView, TextEditor } from "vscode-extension-tester";

import { AutocompleteActions } from "../actions/Autocomplete.actions";
import { GlobalActions } from "../actions/Global.actions";
import { DEFAULT_TIMEOUT } from "../constants";

describe("Autocomplete", () => {
  let editor: TextEditor;

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);

    await GlobalActions.openTestWorkspace();
    ({ editor } = await GlobalActions.createAndOpenNewTextFile());
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    await editor.clearText();
    await new EditorView().closeAllEditors();
  });

  it("Should display completions", async () => {
    await AutocompleteActions.testCompletions(editor);
  }).timeout(DEFAULT_TIMEOUT.XL);
  it("Should force a completion using the command", async () => {
    const ghostText = await AutocompleteActions.forceCompletion(editor);
    expect(ghostText).to.not.be.empty;
  }).timeout(DEFAULT_TIMEOUT.XL);
});
