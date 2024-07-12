/* eslint-disable @typescript-eslint/naming-convention */
import { ContinueConfig, IDE } from "core";
import * as vscode from "vscode";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import { Telemetry } from "core/util/posthog";
import { walkDir } from "core/indexing/walkDir";
import { appendToHistory, getHistoryQuickPickVal } from "./HistoryQuickPick";
import { getContextProviderQuickPickVal } from "./ContextProvidersQuickPick";
import { getModelQuickPickVal } from "./ModelSelectionQuickPick";

// @ts-ignore - error finding typings
import MiniSearch from "minisearch";

/**
 * Used to track what action to take after a user interacts
 * with the initial Quick Pick
 */
enum QuickEditInitialItemLabels {
  History = "History",
  ContextProviders = "Context providers",
  Model = "Model",
  Submit = "Submit",
}

type FileMiniSearchResult = { filename: string };

/**
 * Quick Edit is a collection of Quick Picks that allow the user to
 * quickly edit a file.
 */
export class QuickEdit {
  private static fileSearchChar = "@";

  /**
   * Matches the search char followed by non-space chars, excluding matches ending with a space.
   * This is used to detect file search queries while allowing subsequent prompt text
   */
  private static hasFileSearchQueryRegex = new RegExp(
    `${QuickEdit.fileSearchChar}[^${QuickEdit.fileSearchChar}\\s]+(?!\\s)$`,
  );

  private static maxFileSearchResults = 20;
  private miniSearch = new MiniSearch<FileMiniSearchResult>({
    fields: ["filename"],
    storeFields: ["filename"],
    searchOptions: {
      prefix: true,
      fuzzy: 2,
    },
  });

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

  /**
   * Stores the current model title for potential changes
   */
  private _curModelTitle?: string;

  constructor(
    private readonly verticalDiffManager: VerticalPerLineDiffManager,
    private readonly config: ContinueConfig,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: IDE,
    private readonly context: vscode.ExtensionContext,
  ) {
    this.intializeQuickEditState();
  }

  private async intializeQuickEditState() {
    const editor = vscode.window.activeTextEditor!;

    const existingHandler = this.verticalDiffManager.getHandlerForFile(
      editor.document.uri.fsPath ?? "",
    );

    const workspaceDirs = await this.ide.getWorkspaceDirs();

    const results = await Promise.all(
      workspaceDirs.map((dir) => {
        return walkDir(dir, this.ide);
      }),
    );

    const filenames = results.flat().map((file) => ({
      id: file,
      filename: vscode.workspace.asRelativePath(file),
    }));

    this.miniSearch.addAll(filenames);
    this.editorWhenOpened = editor;
    this.previousInput = existingHandler?.input;
  }

  /**
   * Gets the model title the user has chosen, or their default model
   */
  private async _getCurModelTitle() {
    if (this._curModelTitle) {
      return this._curModelTitle;
    }

    let defaultModelTitle =
      this.config.experimental?.modelRoles?.inlineEdit ??
      (await this.webviewProtocol.request("getDefaultModelTitle", undefined));

    if (!defaultModelTitle) {
      defaultModelTitle = this.config.models[0]?.title!;
    }

    return defaultModelTitle;
  }

  /**
   * Generates a title for the Quick Pick, including the
   * file name and selected line(s) if available.
   *
   * @example
   * // "Edit myFile.ts", "Edit myFile.ts:5-10", "Edit myFile.ts:15"
   */
  _getQuickPickTitle = () => {
    const uri = this.editorWhenOpened.document.uri;

    if (!uri) {
      return "Edit";
    }

    const fileName = vscode.workspace.asRelativePath(uri, true);
    const { start, end } = this.editorWhenOpened.selection;
    const selectionEmpty = this.editorWhenOpened.selection.isEmpty;

    return selectionEmpty
      ? `Edit ${fileName}`
      : `Edit ${fileName}:${start.line}${
          end.line > start.line ? `-${end.line}` : ""
        }`;
  };

  private async _streamEditWithInputAndContext(prompt: string) {
    const modelTitle = await this._getCurModelTitle();

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

    this.webviewProtocol.request("incrementFtc", undefined);

    await this.verticalDiffManager.streamEdit(
      prompt,
      modelTitle,
      undefined,
      this.previousInput,
    );
  }

  async _getInitialQuickPickVal(
    injectedPrompt?: string,
  ): Promise<string | undefined> {
    const modelTitle = await this._getCurModelTitle();

    const initialItems: vscode.QuickPickItem[] = [
      {
        label: QuickEditInitialItemLabels.History,
        detail: "$(history) Select previous prompts",
      },
      {
        label: QuickEditInitialItemLabels.ContextProviders,
        detail: "$(add) Add context to your prompt",
      },
      {
        label: QuickEditInitialItemLabels.Model,
        detail: `$(chevron-down) ${modelTitle}`,
      },
    ];

    /**
     * The user has to select an item to submit the prompt,
     * so we add a "Submit" item once the user has begun to
     * type their prompt that is always displayed
     */
    const submitItem: vscode.QuickPickItem = {
      label: "Submit",
      alwaysShow: true,
    };

    /**
     * Used to show the current file in the Quick Pick,
     * as soon as the user types the search character
     */
    const currentFileItem: vscode.QuickPickItem = {
      label: vscode.workspace.asRelativePath(
        this.editorWhenOpened.document.uri,
      ),
      description: "Current file",
      alwaysShow: true,
    };

    const noResultsItem: vscode.QuickPickItem = { label: "No results found" };

    const quickPick = vscode.window.createQuickPick();

    quickPick.items = initialItems;
    quickPick.placeholder =
      "Enter a prompt to edit your code (@ to search files, ⏎ to submit)";
    quickPick.title = this._getQuickPickTitle();
    quickPick.ignoreFocusOut = true;
    quickPick.value = injectedPrompt ?? "";

    quickPick.show();

    /**
     * Programatically modify the Quick Pick items based on the input value.
     *
     * Shows the current file for a new file search, performs a file search,
     * or shows the submit option.
     *
     * If the input is empty, shows the initial items.
     */
    quickPick.onDidChangeValue((value) => {
      if (value !== "") {
        switch (true) {
          case value.endsWith(QuickEdit.fileSearchChar):
            quickPick.items = [currentFileItem];
            break;

          case QuickEdit.hasFileSearchQueryRegex.test(value):
            const lastAtIndex = value.lastIndexOf(QuickEdit.fileSearchChar);

            // The search query is the last instance of the
            // search character to the end of the string
            const searchQuery = value.substring(lastAtIndex + 1);

            const searchResults = this.miniSearch.search(
              searchQuery,
            ) as FileMiniSearchResult[];

            if (searchResults.length > 0) {
              quickPick.items = searchResults
                .map(({ filename }) => ({
                  label: filename,
                  alwaysShow: true,
                }))
                .slice(0, QuickEdit.maxFileSearchResults);
            } else {
              quickPick.items = [noResultsItem];
            }

            break;

          default:
            // The user does not have a file search in progress,
            // tso only show the submit option
            quickPick.items = [submitItem];
            break;
        }
      } else {
        quickPick.items = initialItems;
      }
    });

    /**
     * Waits for the user to select an item from the quick pick.
     *
     * If the selected item is a file, it replaces the file search query
     * with the selected file path and allows further editing.
     *
     * If the selected item is an initial item, it closes the quick pick
     * and returns the selected item label.
     *
     * @returns {Promise<string | undefined>} The label of the selected item, or undefined if no item was selected.
     */
    const selectedItemLabel = await new Promise<string | undefined>(
      (resolve) => {
        quickPick.onDidAccept(() => {
          const { label } = quickPick.selectedItems[0];

          // If not an initial item, it's a file selection. Allow continued prompt editing.
          const isFileSelection = !Object.values(
            QuickEditInitialItemLabels,
          ).includes(label as QuickEditInitialItemLabels);

          if (isFileSelection) {
            // Replace the file search query with the selected file path
            const curValue = quickPick.value;
            const newValue =
              curValue.substring(0, curValue.lastIndexOf("@") + 1) +
              label +
              " ";

            quickPick.value = newValue;
            quickPick.items = [submitItem];
          } else {
            // The user has selected one of the initial items, so we close the Quick Pick
            resolve(label);
            quickPick.dispose();
          }
        });
      },
    );

    const shouldSubmitPrompt =
      !selectedItemLabel ||
      selectedItemLabel === QuickEditInitialItemLabels.Submit;

    if (shouldSubmitPrompt) {
      return quickPick.value;
    }

    return selectedItemLabel;
  }

  /**
   * Shows the Quick Edit Quick Pick, allowing the user to select an initial item or enter a prompt.
   * Displays a quick pick for "History" or "ContextProviders" to set the prompt or context provider string.
   * Displays a quick pick for "Model" to set the current model title.
   * Appends the entered prompt to the history and streams the edit with input and context.
   */
  async show(initialPrompt?: string) {
    const selectedLabelOrInputVal = await this._getInitialQuickPickVal(
      initialPrompt,
    );

    Telemetry.capture("quickEditSelection", {
      selection: selectedLabelOrInputVal,
    });

    let prompt: string | undefined = undefined;

    switch (selectedLabelOrInputVal) {
      case QuickEditInitialItemLabels.History:
        const historyVal = await getHistoryQuickPickVal(this.context);
        prompt = historyVal ?? "";
        break;

      case QuickEditInitialItemLabels.ContextProviders:
        const contextProviderVal = await getContextProviderQuickPickVal(
          this.config,
          this.ide,
        );
        this.contextProviderStr = contextProviderVal ?? "";

        // Recurse back to let the user write their prompt
        this.show(initialPrompt);

        break;

      case QuickEditInitialItemLabels.Model:
        const curModelTitle = await this._getCurModelTitle();
        const selectedModelTitle = await getModelQuickPickVal(
          curModelTitle,
          this.config,
        );

        if (selectedModelTitle) {
          this._curModelTitle = selectedModelTitle;
        }

        // Recurse back to let the user write their prompt
        this.show(initialPrompt);

        break;

      default:
        // If it wasn't a label we can assume it was user input
        if (selectedLabelOrInputVal) {
          prompt = selectedLabelOrInputVal;
          appendToHistory(selectedLabelOrInputVal, this.context);
        }
    }

    if (prompt) {
      await this._streamEditWithInputAndContext(prompt);
    }
  }
}
