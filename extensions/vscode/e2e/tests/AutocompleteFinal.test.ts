import {
  EditorView,
  TextEditor,
  InputBox,
  Workbench,
} from "vscode-extension-tester";

import { TestUtils } from "../TestUtils";
import { DEFAULT_TIMEOUT } from "../constants";
import { AutocompleteSelectors } from "../selectors/Autocomplete.selectors";
import { expect } from "chai";
import { GlobalActions } from "../actions/Global.actions";

describe("Autocomplete", () => {
  let editor: TextEditor;

  beforeEach(async function () {
    this.timeout(DEFAULT_TIMEOUT);

    await GlobalActions.openTestWorkspace();
    await new Workbench().executeCommand("Create: New File...");
    await (await InputBox.create()).selectQuickPick("Text File");
    editor = (await new EditorView().openEditor("Untitled-1")) as TextEditor;
  });

  afterEach(async function () {
    this.timeout(DEFAULT_TIMEOUT);
    await editor.clearText();
    await new EditorView().closeAllEditors();
  });

  it("Should display completions", async () => {
    const driver = editor.getDriver();

    const messagePair0 = TestUtils.generateTestMessagePair(0);
    await editor.typeTextAt(1, 1, messagePair0.userMessage);
    await editor.typeTextAt(1, messagePair0.userMessage.length + 1, " ");
    const ghostText0 = await TestUtils.waitForElement(
      () => AutocompleteSelectors.getGhostTextContent(driver),
      // The first completion takes longer because Continue needs to load
      DEFAULT_TIMEOUT,
    );
    expect(ghostText0).to.equal(messagePair0.llmResponse);

    await editor.clearText();

    const messagePair1 = TestUtils.generateTestMessagePair(1);
    await editor.typeTextAt(1, 1, messagePair1.userMessage);
    await editor.typeTextAt(1, messagePair1.userMessage.length + 1, " ");
    const ghostText1 = await TestUtils.waitForElement(() =>
      AutocompleteSelectors.getGhostTextContent(driver),
    );
    expect(ghostText1).to.equal(messagePair1.llmResponse);
  }).timeout(DEFAULT_TIMEOUT);
});
