import { expect } from "chai";
import { EditorView, TextEditor } from "vscode-extension-tester";

import { GlobalActions } from "../actions/Global.actions";
import { NextEditActions } from "../actions/NextEdit.actions";
import { DEFAULT_TIMEOUT } from "../constants";

describe("Next Edit", () => {  
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

  it("Should enable Next Edit feature in settings", async () => {
    expect(false).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should check that autocomplete is disabled when next edit is enabled", async () => {
    expect(false).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should accept Next Edit suggestion with Tab", async () => {
    expect(false).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should reject Next Edit suggestion with Esc", async () => {
    expect(false).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);

  it.only("Should force a Next Edit", async () => {
    const hasDecoration = await NextEditActions.forceNextEdit(editor);
    expect(hasDecoration).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);
});