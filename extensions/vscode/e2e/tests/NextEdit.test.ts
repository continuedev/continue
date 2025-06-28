import { expect } from "chai";
import * as fs from "fs";
import { EditorView, TextEditor } from "vscode-extension-tester";

import { GlobalActions } from "../actions/Global.actions";
import { NextEditActions } from "../actions/NextEdit.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { TestUtils } from "../TestUtils";

describe("Next Edit", () => {  
  let editor: TextEditor;

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    
    // Update config.json to add optInNextEditFeature.
    const globalContext = fs.readFileSync(TestUtils.getGlobalContextFilePath(), "utf8");
    const sharedConfig = JSON.parse(globalContext).sharedConfig;
    
    const sharedConfigWithNextEditEnabled = {
      ...sharedConfig,
      "optInNextEditFeature": true
    };

    const globalContextWithNextEditEnabled = {
      ...JSON.parse(globalContext),
      "sharedConfig": sharedConfigWithNextEditEnabled
    };
    
    fs.writeFileSync(TestUtils.getGlobalContextFilePath(), JSON.stringify(globalContextWithNextEditEnabled, null, 2), "utf8");
    await NextEditActions.reload();
  });

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

  after(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL);
    
    // Update config.json to delete optInNextEditFeature.
    const globalContext = fs.readFileSync(TestUtils.getGlobalContextFilePath(), "utf8");
    const sharedConfig = JSON.parse(globalContext).sharedConfig;
  
    const sharedConfigWithoutNextEdit = { ...sharedConfig };
    delete sharedConfigWithoutNextEdit.optInNextEditFeature;

    const globalContextWithNextEditEnabled = {
      ...JSON.parse(globalContext),
      "sharedConfig": sharedConfigWithoutNextEdit
    };

    fs.writeFileSync(TestUtils.getGlobalContextFilePath(), JSON.stringify(globalContextWithNextEditEnabled, null, 2), "utf8");
    await NextEditActions.reload();
  });

  // it("Should enable Next Edit feature in settings", async () => {
  //   expect(false).to.be.true;
  // }).timeout(DEFAULT_TIMEOUT.XL);

  // it("Should check that autocomplete is disabled when next edit is enabled", async () => {
  //   expect(false).to.be.true;
  // }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should accept Next Edit suggestion with Tab", async () => {
    const accepted = await NextEditActions.acceptNextEditSuggestion(editor);
    expect (accepted).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should reject Next Edit suggestion with Esc", async () => {
    const rejected = await NextEditActions.rejectNextEditSuggestion(editor);
    expect(rejected).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should force a Next Edit", async () => {
    const hasDecoration = await NextEditActions.forceNextEdit(editor);
    expect(hasDecoration).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XL);
});