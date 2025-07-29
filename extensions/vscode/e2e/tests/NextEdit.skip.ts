import * as fs from "fs/promises";

import { expect } from "chai";
import { EditorView, TextEditor } from "vscode-extension-tester";

import { GlobalActions } from "../actions/Global.actions";
import { NextEditActions } from "../actions/NextEdit.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { TestUtils } from "../TestUtils";

describe("Next Edit", () => {
  let editor: TextEditor;

  before(async function () {
    // this.timeout(DEFAULT_TIMEOUT.XL);

    const globalContextPath = TestUtils.getGlobalContextFilePath();

    // Update config.json to add optInNextEditFeature.
    // globalContext.json does not exist in CI before this test runs.
    if (await TestUtils.fileExists(globalContextPath)) {
      const globalContext = await fs.readFile(globalContextPath, "utf8");
      const sharedConfig = JSON.parse(globalContext).sharedConfig;

      const sharedConfigWithNextEditEnabled = {
        ...sharedConfig,
        optInNextEditFeature: true,
      };

      const globalContextWithNextEditEnabled = {
        ...JSON.parse(globalContext),
        sharedConfig: sharedConfigWithNextEditEnabled,
      };

      await fs.writeFile(
        globalContextPath,
        JSON.stringify(globalContextWithNextEditEnabled, null, 2),
        "utf8",
      );
    } else {
      await fs.writeFile(
        globalContextPath,
        JSON.stringify(
          {
            sharedConfig: {
              optInNextEditFeature: true,
            },
            selectedModelsByProfileId: {
              local: {
                chat: "TEST LLM",
                edit: "TEST LLM",
                apply: "TEST LLM",
                embed: "Transformers.js (Built-In)",
                autocomplete: "TEST LLM",
                rerank: null,
                summarize: null,
              },
            },
          },
          null,
          2,
        ),
      );
    }

    await NextEditActions.reload();
  }).timeout(DEFAULT_TIMEOUT.XL);

  beforeEach(async function () {
    // this.timeout(DEFAULT_TIMEOUT.XL);

    await GlobalActions.openTestWorkspace();
    ({ editor } = await GlobalActions.createAndOpenNewTextFile());
  }).timeout(DEFAULT_TIMEOUT.XL);

  afterEach(async function () {
    // this.timeout(DEFAULT_TIMEOUT.XL);

    await editor.clearText();
    await new EditorView().closeAllEditors();
  }).timeout(DEFAULT_TIMEOUT.XL);

  after(async function () {
    // this.timeout(DEFAULT_TIMEOUT.XL);

    // Update config.json to delete optInNextEditFeature.
    const globalContext = await fs.readFile(
      TestUtils.getGlobalContextFilePath(),
      "utf8",
    );
    const sharedConfig = JSON.parse(globalContext).sharedConfig;

    const sharedConfigWithoutNextEdit = { ...sharedConfig };
    delete sharedConfigWithoutNextEdit.optInNextEditFeature;

    const globalContextWithNextEditEnabled = {
      ...JSON.parse(globalContext),
      sharedConfig: sharedConfigWithoutNextEdit,
    };

    await fs.writeFile(
      TestUtils.getGlobalContextFilePath(),
      JSON.stringify(globalContextWithNextEditEnabled, null, 2),
      "utf8",
    );
    await NextEditActions.reload();
  }).timeout(DEFAULT_TIMEOUT.XL);

  // it("Should enable Next Edit feature in settings", async () => {
  //   expect(false).to.be.true;
  // }).timeout(DEFAULT_TIMEOUT.XL);

  // it("Should check that autocomplete is disabled when next edit is enabled", async () => {
  //   expect(false).to.be.true;
  // }).timeout(DEFAULT_TIMEOUT.XL);

  it("Should force a Next Edit", async () => {
    const hasDecoration = await NextEditActions.forceNextEdit(editor);
    expect(hasDecoration).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XXL);

  it("Should accept Next Edit suggestion with Tab", async () => {
    const accepted = await NextEditActions.acceptNextEditSuggestion(editor);
    expect(accepted).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XXL);

  it("Should reject Next Edit suggestion with Esc", async () => {
    const rejected = await NextEditActions.rejectNextEditSuggestion(editor);
    expect(rejected).to.be.true;
  }).timeout(DEFAULT_TIMEOUT.XXL);
});
