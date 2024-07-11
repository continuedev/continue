/* eslint-disable @typescript-eslint/naming-convention */
import { ContinueConfig, IDE } from "core";
import { fetchwithRequestOptions } from "core/util/fetchWithOptions";
import * as vscode from "vscode";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import { Telemetry } from "core/util/posthog";

// @ts-ignore - error finding typings
import MiniSearch from "minisearch";
import { walkDir } from "core/indexing/walkDir";

enum QuickEditInitialItemLabels {
  History = "History",
  ContextProviders = "Context providers",
  Model = "Model",
  Submit = "Submit",
}

type FileMiniSearchResult = { filename: string };

export class QuickEdit {
  private static historyKey = "quickEditHistory";
  private static maxHistoryLength = 50;
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
   * Used to store the current model title in case the user selects a
   * different title.
   */
  private _curModelTitle?: string;

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

  private async getCurModelTitle(): Promise<string> {
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

  _getQuickPickTitle = () => {
    const { activeTextEditor } = vscode.window;
    const uri = activeTextEditor?.document.uri;

    if (!uri) {
      return "Edit";
    }

    const fileName = vscode.workspace.asRelativePath(uri, true);
    const { start, end } = activeTextEditor?.selection;
    const selectionEmpty = activeTextEditor?.selection.isEmpty;

    return selectionEmpty
      ? `Edit ${fileName}`
      : `Edit ${fileName}:${start.line}${
          end.line > start.line ? `-${end.line}` : ""
        }`;
  };

  private async _getContextProviderItems(): Promise<vscode.QuickPickItem[]> {
    const { contextProviders } = this.config;

    if (!contextProviders) {
      return [];
    }

    const quickPickItems = contextProviders
      .filter((provider) => provider.description.type === "normal")
      .map((provider) => {
        return {
          label: provider.description.displayTitle,
          detail: provider.description.description,
        };
      });

    return quickPickItems;
  }

  private async _showContextProviderPicker() {
    const contextProviderItems = await this._getContextProviderItems();

    const quickPick = vscode.window.createQuickPick();

    quickPick.items = contextProviderItems;
    quickPick.title = "Context providers";
    quickPick.placeholder = "Select a context provider to add to your prompt";
    quickPick.canSelectMany = true;

    quickPick.show();

    const val = await new Promise<string>((resolve) => {
      quickPick.onDidAccept(async () => {
        const selectedItems = Array.from(quickPick.selectedItems);
        const context = await this._getContextProvidersString(selectedItems);
        resolve(context);
      });
    });

    quickPick.dispose();

    return val;
  }

  private async _getContextProvidersString(
    selectedProviders: vscode.QuickPickItem[] | undefined,
  ): Promise<string> {
    const contextItems = (
      await Promise.all(
        selectedProviders?.map((selectedProvider) => {
          const provider = this.config.contextProviders?.find(
            (provider) =>
              provider.description.displayTitle === selectedProvider.label,
          );

          if (!provider) {
            return [];
          }

          return provider.getContextItems("", {
            embeddingsProvider: this.config.embeddingsProvider,
            reranker: this.config.reranker,
            ide: this.ide,
            llm: this.config.models[0],
            fullInput: "",
            selectedCode: [],
            fetch: (url, init) =>
              fetchwithRequestOptions(url, init, this.config.requestOptions),
          });
        }) || [],
      )
    ).flat();

    return (
      contextItems.map((item) => item.content).join("\n\n") + "\n\n---\n\n"
    );
  }

  private async _streamEditWithInputAndContext(prompt: string) {
    const modelTitle = await this.getCurModelTitle();

    const fileReferences = prompt.match(/@[^\s]+/g) || [];

    for (const fileRef of fileReferences) {
      const filePath = fileRef.slice(1); // Remove the '@' symbol

      const fileContent = await this.ide.readFile(filePath);
      prompt = prompt.replace(
        fileRef,
        `\`\`\`${filePath}\n${fileContent}\n\`\`\`\n\n`,
      );
    }

    if (this.contextProviderStr) {
      prompt = `${this.contextProviderStr}${prompt}`;
    }

    this.webviewProtocol.request("incrementFtc", undefined);

    await this.verticalDiffManager.streamEdit(
      prompt,
      modelTitle,
      undefined,
      this.previousInput,
    );
  }

  private _appendToHistory(item: string) {
    let history: string[] = this.context.globalState.get(
      QuickEdit.historyKey,
      [],
    );

    // Remove duplicate if exists
    if (history[history.length - 1] === item) {
      history = history.slice(0, -1);
    }

    // Add new item
    history.push(item);

    // Truncate if over max size
    if (history.length > QuickEdit.maxHistoryLength) {
      history = history.slice(-QuickEdit.maxHistoryLength);
    }

    this.context.globalState.update(QuickEdit.historyKey, history);
  }

  private async _showModelPicker() {
    const curModelTitle = await this.getCurModelTitle();

    const modelItems: vscode.QuickPickItem[] = this.config.models.map(
      (model) => {
        const isCurModel = curModelTitle === model.title;

        return {
          label: model.title
            ? `${isCurModel ? "$(check)" : "     "} ${model.title}`
            : "Model title not set",
        };
      },
    );

    const selectedItem = await vscode.window.showQuickPick(modelItems, {
      title: "Models",
      placeHolder: "Select a model",
    });

    if (!selectedItem) {
      return undefined;
    }

    const selectedModelTitle = this.config.models.find(
      (model) => model.title && selectedItem.label.includes(model.title),
    )?.title;

    return selectedModelTitle;
  }

  async _showHistoryPicker(): Promise<string | undefined> {
    const historyItems: vscode.QuickPickItem[] = this.context.globalState
      .get(QuickEdit.historyKey, [])
      .map((item) => ({ label: item }))
      .reverse();

    const selectedItem = await vscode.window.showQuickPick(historyItems, {
      title: "History",
      placeHolder: "Select a previous prompt",
    });

    return selectedItem?.label;
  }

  async _showInitialQuickPick(
    injectedPrompt?: string,
  ): Promise<string | undefined> {
    const modelTitle = await this.getCurModelTitle();

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

    const submitItem: vscode.QuickPickItem = {
      label: "Submit",
      detail: "Submit your prompt",
      alwaysShow: true,
    };

    const quickPick = vscode.window.createQuickPick();

    quickPick.items = initialItems;
    quickPick.placeholder =
      "Enter a prompt to edit your code (@ to search files, ⏎ to submit)";
    quickPick.title = this._getQuickPickTitle();
    quickPick.ignoreFocusOut = true;
    quickPick.value = injectedPrompt ?? "";

    quickPick.show();

    quickPick.onDidChangeValue((value) => {
      if (value !== "") {
        switch (true) {
          // Bring up current file as the default option for a new file search
          case value.endsWith("@"):
            const relativeFilename = vscode.workspace.asRelativePath(
              this.editorWhenOpened.document.uri,
            );

            quickPick.items = [
              {
                label: relativeFilename,
                description: "Current file",
                alwaysShow: true,
              },
            ];

            break;

          // Matches '@' followed by non-space chars, excluding matches ending with a space
          // This detects file search queries while allowing subsequent prompt text
          case /@[^@\s]+(?!\s)$/.test(value):
            const lastAtIndex = value.lastIndexOf("@");
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
              quickPick.items = [{ label: "No results found" }];
            }

            break;

          // The user does not have a file search in progress, so only show
          // the submit option
          default:
            quickPick.items = [submitItem];
            break;
        }
      } else {
        quickPick.items = initialItems;
      }
    });

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

  async run(injectedPrompt?: string) {
    const quickPickItemOrInput = await this._showInitialQuickPick(
      injectedPrompt,
    );

    Telemetry.capture("quickEditSelection", {
      selection: quickPickItemOrInput,
    });

    let prompt: string | undefined = undefined;

    switch (quickPickItemOrInput) {
      case QuickEditInitialItemLabels.History:
        prompt = (await this._showHistoryPicker()) ?? "";
        break;

      case QuickEditInitialItemLabels.ContextProviders:
        this.contextProviderStr =
          (await this._showContextProviderPicker()) ?? "";

        // Recurse back to let the user write their prompt
        this.run(injectedPrompt);

        break;

      case QuickEditInitialItemLabels.Model:
        const selectedModelTitle = await this._showModelPicker();

        if (selectedModelTitle) {
          this._curModelTitle = selectedModelTitle;
        }

        // Recurse back to let the user write their prompt
        this.run(injectedPrompt);

        break;

      default:
        // If it wasn't a label we can assume it was user input
        if (quickPickItemOrInput) {
          prompt = quickPickItemOrInput;
          this._appendToHistory(quickPickItemOrInput);
        }
    }

    if (prompt) {
      await this._streamEditWithInputAndContext(prompt);
    }
  }
}
