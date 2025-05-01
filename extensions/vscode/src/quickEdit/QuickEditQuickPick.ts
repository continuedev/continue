/* eslint-disable @typescript-eslint/naming-convention */
import { IDE, ILLM, RuleWithSource } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { DataLogger } from "core/data/log";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import { VerticalDiffManager } from "../diff/vertical/manager";
import { FileSearch } from "../util/FileSearch";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

import { getContextProviderQuickPickVal } from "./ContextProvidersQuickPick";
import { appendToHistory, getHistoryQuickPickVal } from "./HistoryQuickPick";

// @ts-ignore - error finding typings
// @ts-ignore

/**
 * Used to track what action to take after a user interacts
 * with the initial Quick Pick
 */
enum QuickEditInitialItemLabels {
  History = "History",
  ContextProviders = "Context providers",
  Submit = "Submit",
}

enum UserPromptLabels {
  AcceptAll = "Accept all (Shift + Cmd + Enter)",
  RejectAll = "Reject all (Shift + Cmd + Backspace)",
  CloseDialog = "Close dialog",
}

export type QuickEditShowParams = {
  initialPrompt?: string;
  /**
   * Used for Quick Actions where the user has not highlighted code.
   * Instead the range comes from the document symbol.
   */
  range?: vscode.Range;
};

const FILE_SEARCH_CHAR = "@";

/**
 * The user has to select an item to submit the prompt,
 * so we add a "Submit" item once the user has begun to
 * type their prompt that is always displayed
 */
const SUBMIT_ITEM: vscode.QuickPickItem = {
  label: "Submit",
  alwaysShow: true,
};

const NO_RESULTS_ITEM: vscode.QuickPickItem = { label: "No results found" };

const REVIEW_CHANGES_ITEMS: vscode.QuickPickItem[] = [
  {
    label: UserPromptLabels.AcceptAll,
    alwaysShow: true,
  },
  { label: UserPromptLabels.RejectAll, alwaysShow: true },
  {
    label: UserPromptLabels.CloseDialog,
    alwaysShow: true,
  },
];

/**
 * Quick Edit is a collection of Quick Picks that allow the user to
 * quickly edit a file.
 */
export class QuickEdit {
  /**
   * Matches the search char followed by non-space chars, excluding matches ending with a space.
   * This is used to detect file search queries while allowing subsequent prompt text
   */
  private static hasFileSearchQueryRegex = new RegExp(
    `${FILE_SEARCH_CHAR}[^${FILE_SEARCH_CHAR}\\s]+(?!\\s)$`,
  );

  private static maxFileSearchResults = 20;

  private range?: vscode.Range;
  private initialPrompt?: string;

  private previousInput?: string;

  /**
   * Handles situations where the user navigates to a different editor
   * while interacting with the Quick Pick
   */
  private editorWhenOpened!: vscode.TextEditor;

  /**
   * Required to store the string content of a context provider
   * while naviagting beween Quick Picks.
   */
  private contextProviderStr?: string;

  constructor(
    private readonly verticalDiffManager: VerticalDiffManager,
    private readonly configHandler: ConfigHandler,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: IDE,
    private readonly context: vscode.ExtensionContext,
    private readonly fileSearch: FileSearch,
  ) {}

  /**
   * Shows the Quick Edit Quick Pick, allowing the user to select an initial item or enter a prompt.
   * Displays a quick pick for "History" or "ContextProviders" to set the prompt or context provider string.
   * Displays a quick pick for "Model" to set the current model title.
   * Appends the entered prompt to the history and streams the edit with input and context.
   */
  async show(params?: QuickEditShowParams) {
    // Clean up state from previous quick picks, e.g. if a user pressed `esc`

    const editor = vscode.window.activeTextEditor;

    // We only allow users to interact with a quick edit if there is an open editor
    if (!editor) {
      return;
    }

    const hasChanges = !!this.verticalDiffManager.getHandlerForFile(
      editor.document.uri.toString(),
    );

    if (hasChanges) {
      this.openAcceptRejectMenu("", editor.document.uri.toString());
    } else {
      await this.initiateNewQuickPick(editor, params);
    }
  }

  private async initiateNewQuickPick(
    editor: vscode.TextEditor,
    params: QuickEditShowParams | undefined,
  ) {
    this.clear();
    // Set state that is unique to each quick pick instance
    this.setActiveEditorAndPrevInput(editor);

    if (!this.editorWhenOpened) {
      return;
    }

    if (!!params?.initialPrompt) {
      this.initialPrompt = params.initialPrompt;
    }

    this.range = !!params?.range
      ? params.range
      : this.editorWhenOpened.selection;

    const { label: selectedLabel, value: selectedValue } =
      await this._getInitialQuickPickVal();

    if (!selectedValue && !selectedLabel) {
      return;
    }

    Telemetry.capture("quickEditSelection", {
      selection: {
        label: selectedLabel,
        value: selectedValue,
      },
    });

    const prompt = await this.handleSelect({
      selectedLabel,
      selectedValue,
      editor,
      params,
    });

    if (prompt) {
      await this.handleUserPrompt(prompt, editor.document.uri.toString());
    }
  }

  private openAcceptRejectMenu(prompt: string, path: string | undefined) {
    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = "Type your acceptance decision";

    quickPick.title = "Accept changes";
    quickPick.value = prompt;
    quickPick.items = REVIEW_CHANGES_ITEMS;
    quickPick.placeholder =
      "Accept or reject changes. Start typing to try again with a new prompt.";
    quickPick.show();

    quickPick.onDidChangeValue(() => {
      quickPick.items = [prompt, ""].includes(quickPick.value)
        ? REVIEW_CHANGES_ITEMS
        : [SUBMIT_ITEM];
    });

    quickPick.onDidAccept(async () => {
      const { label } = quickPick.selectedItems[0];
      switch (label) {
        case UserPromptLabels.AcceptAll:
          vscode.commands.executeCommand("continue.acceptDiff", path);
          break;
        case UserPromptLabels.RejectAll:
          vscode.commands.executeCommand("continue.rejectDiff", path);
          break;
        case QuickEditInitialItemLabels.Submit:
          if (quickPick.value) {
            await vscode.commands.executeCommand("continue.rejectDiff", path);
            const newPrompt = quickPick.value;
            appendToHistory(newPrompt, this.context);
            this.handleUserPrompt(newPrompt, path);
          }
          break;
        default:
          break;
      }
      let model = await this.getCurModel();

      void DataLogger.getInstance().logDevData({
        name: "quickEdit",
        data: {
          prompt,
          path,
          label,
          diffs: this.verticalDiffManager.logDiffs,
          model: model?.title,
        },
      });

      quickPick.dispose();
    });
  }

  private handleUserPrompt = async (
    prompt: string,
    path: string | undefined,
  ) => {
    const model = await this.getCurModel();
    if (!model) {
      throw new Error("No model selected");
    }

    const { config } = await this.configHandler.loadConfig();
    const rules = config?.rules ?? []; // no need to error - getCurModel above will handle

    await this._streamEditWithInputAndContext(prompt, model, rules);
    this.openAcceptRejectMenu(prompt, path);
  };

  private setActiveEditorAndPrevInput(editor: vscode.TextEditor) {
    const existingHandler = this.verticalDiffManager.getHandlerForFile(
      editor.document.uri.toString(),
    );

    this.editorWhenOpened = editor;
    this.previousInput = existingHandler?.options.input;
  }

  /**
   * Gets the model title the user has chosen, or their default model
   */
  private async getCurModel(): Promise<ILLM | null> {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return null;
    }

    return config.selectedModelByRole.edit ?? config.selectedModelByRole.chat;
  }

  /**
   * Generates a title for the Quick Pick, including the
   * file name and selected line(s) if available.
   *
   * @example
   * // "Edit myFile.ts", "Edit myFile.ts:5-10", "Edit myFile.ts:15"
   */
  private getQuickPickTitle = () => {
    const { uri } = this.editorWhenOpened.document;

    const fileName = vscode.workspace.asRelativePath(uri, true);

    if (!this.range) {
      throw new Error("Range is undefined");
    }

    const { start, end } = this.range;

    const isSelectionEmpty = start.isEqual(end);

    return isSelectionEmpty
      ? `Edit ${fileName}`
      : `Edit ${fileName}:${start.line}${
          end.line > start.line ? `-${end.line}` : ""
        }`;
  };

  private async _streamEditWithInputAndContext(
    prompt: string,
    model: ILLM,
    rules: RuleWithSource[],
  ) {
    // Extracts all file references from the prompt string,
    // which are denoted by  an '@' symbol followed by
    // one or more non-whitespace characters.
    const fileReferences = prompt.match(/@[^\s]+/g) || [];

    // Replace file references with the content of the file
    for (const fileRef of fileReferences) {
      const filePath = fileRef.slice(1); // Remove the '@' symbol

      const fileContent = await this.ide.readFile(filePath);

      prompt = prompt.replace(
        fileRef,
        `\`\`\`${filePath}\n${fileContent}\n\`\`\`\n\n`,
      );
    }

    if (this.contextProviderStr) {
      prompt = this.contextProviderStr + prompt;
    }

    void this.webviewProtocol.request("incrementFtc", undefined);

    await this.verticalDiffManager.streamEdit({
      input: prompt,
      llm: model,
      quickEdit: this.previousInput,
      range: this.range,
      includeRulesAsSystemMessage: rules,
    });
  }

  private getInitialItems(): vscode.QuickPickItem[] {
    return [
      {
        label: QuickEditInitialItemLabels.History,
        detail: "$(history) Select previous prompts",
      },
      {
        label: QuickEditInitialItemLabels.ContextProviders,
        detail: "$(add) Add context to your prompt",
      },
    ];
  }

  async _getInitialQuickPickVal(): Promise<{
    label: QuickEditInitialItemLabels | undefined;
    value: string | undefined;
  }> {
    const modelTitle = await this.getCurModel();

    if (!modelTitle) {
      this.ide.showToast("error", "Please configure a model to use Quick Edit");
      return { label: undefined, value: undefined };
    }

    const quickPick = vscode.window.createQuickPick();

    const initialItems = this.getInitialItems();
    quickPick.items = initialItems;
    quickPick.placeholder =
      "Enter a prompt to edit your code (@ to search files, ⏎ to submit)";
    quickPick.title = this.getQuickPickTitle();
    quickPick.ignoreFocusOut = true;
    quickPick.value = this.initialPrompt ?? "";

    quickPick.show();

    quickPick.onDidChangeValue((value) =>
      this.handleQuickPickChange({ value, quickPick, initialItems }),
    );
    /**
     * Waits for the user to select an item from the quick pick.
     *
     * @returns {Promise<string | undefined>} The label of the selected item, or undefined if no item was selected.
     */
    const selectedItemLabel = await new Promise<
      QuickEditInitialItemLabels | undefined
    >((resolve) =>
      quickPick.onDidAccept(() => {
        this.handleQuickPickAccept({
          quickPick,
          resolve,
        });
      }),
    );

    return {
      label: selectedItemLabel,
      value: quickPick.value,
    };
  }

  /**
   * Programatically modify the Quick Pick items based on the input value.
   *
   * Shows the current file for a new file search, performs a file search,
   * or shows the submit option.
   *
   * If the input is empty, shows the initial items.
   */
  private handleQuickPickChange = ({
    value,
    quickPick,
    initialItems,
  }: {
    value: string;
    quickPick: vscode.QuickPick<vscode.QuickPickItem>;
    initialItems: vscode.QuickPickItem[];
  }) => {
    const { uri } = this.editorWhenOpened.document;

    if (value !== "") {
      switch (true) {
        case value.endsWith(FILE_SEARCH_CHAR):
          quickPick.items = [
            {
              label: vscode.workspace.asRelativePath(uri),
              description: "Current file",
              alwaysShow: true,
            },
          ];
          break;

        case QuickEdit.hasFileSearchQueryRegex.test(value):
          const lastAtIndex = value.lastIndexOf(FILE_SEARCH_CHAR);

          // The search query is the last instance of the
          // search character to the end of the string
          const searchQuery = value.substring(lastAtIndex + 1);

          const searchResults = this.fileSearch.search(searchQuery);

          if (searchResults.length > 0) {
            quickPick.items = searchResults
              .map(({ relativePath }) => ({
                label: relativePath,
                alwaysShow: true,
              }))
              .slice(0, QuickEdit.maxFileSearchResults);
          } else {
            quickPick.items = [NO_RESULTS_ITEM];
          }

          break;

        default:
          // The user does not have a file search in progress,
          // tso only show the submit option
          quickPick.items = [SUBMIT_ITEM];
          break;
      }
    } else {
      quickPick.items = initialItems;
    }
  };

  /**
   * If the selected item is a file, it replaces the file search query
   * with the selected file path and allows further editing.
   *
   * If the selected item is an initial item, it closes the quick pick
   * and returns the selected item label.
   */
  private handleQuickPickAccept = ({
    quickPick,
    resolve,
  }: {
    quickPick: vscode.QuickPick<vscode.QuickPickItem>;
    resolve: (value: QuickEditInitialItemLabels | undefined) => void;
  }) => {
    const { label } = quickPick.selectedItems[0];

    // If not an initial item, it's a file selection. Allow continued prompt editing.
    const isFileSelection = !Object.values(QuickEditInitialItemLabels).includes(
      label as QuickEditInitialItemLabels,
    );

    if (isFileSelection) {
      // Replace the file search query with the selected file path
      const curValue = quickPick.value;
      const newValue =
        curValue.substring(0, curValue.lastIndexOf("@") + 1) + label + " ";

      quickPick.value = newValue;
      quickPick.items = [SUBMIT_ITEM];
      resolve(undefined);
    } else {
      // The user has selected one of the initial items, so we close the Quick Pick
      resolve(label as QuickEditInitialItemLabels);
      quickPick.dispose();
    }
  };

  private async handleSelect({
    selectedLabel,
    selectedValue,
    editor,
    params,
  }: {
    selectedLabel: QuickEditInitialItemLabels | undefined;
    selectedValue: string | undefined;
    editor: vscode.TextEditor;
    params: QuickEditShowParams | undefined;
  }) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      throw new Error("Config not loaded");
    }

    let prompt: string | undefined;
    switch (selectedLabel) {
      case QuickEditInitialItemLabels.History:
        const historyVal = await getHistoryQuickPickVal(this.context);
        prompt = historyVal ?? "";
        break;

      case QuickEditInitialItemLabels.ContextProviders:
        const contextProviderVal = await getContextProviderQuickPickVal(
          config,
          this.ide,
        );
        this.contextProviderStr = contextProviderVal ?? "";

        // Recurse back to let the user write their prompt
        this.initiateNewQuickPick(editor, params);

        break;

      case QuickEditInitialItemLabels.Submit:
        if (selectedValue) {
          prompt = selectedValue;
          appendToHistory(selectedValue, this.context);
        }
    }

    return prompt;
  }

  /**
   * Reset the state of the quick pick
   */
  private clear() {
    this.initialPrompt = undefined;
    this.range = undefined;
  }
}
