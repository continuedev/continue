/* eslint-disable @typescript-eslint/naming-convention */
import { ContinueConfig, IDE } from "core";
import { fetchwithRequestOptions } from "core/util/fetchWithOptions";
import * as vscode from "vscode";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import { Telemetry } from "core/util/posthog";

enum QuickEditItemLabels {
  History = "History",
  ContextProviders = "Context providers",
  Model = "Model",
  Submit = "Submit",
}

export class QuickEdit {
  private static historyKey = "quickEditHistory";
  private static maxHistoryLength = 50;
  private static maxFileResults = 25;

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

  private intializeQuickEditState() {
    const editor = vscode.window.activeTextEditor!;

    const existingHandler = this.verticalDiffManager.getHandlerForFile(
      editor.document.uri.fsPath ?? "",
    );

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

    return selectedItem?.label;
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

    const items: vscode.QuickPickItem[] = [
      {
        label: QuickEditItemLabels.History,
        detail: "$(history) Select previous prompts",
      },
      {
        label: QuickEditItemLabels.ContextProviders,
        detail: "$(add) Add context to your prompt",
      },
      {
        label: QuickEditItemLabels.Model,
        detail: `$(chevron-down) ${modelTitle}`,
      },
    ];

    /**
     * Not included in `items` because we only show it once users
     * begin to type in a prompt.
     */
    const submitItem: vscode.QuickPickItem = {
      label: QuickEditItemLabels.Submit,
      detail: "Submit your prompt",
      alwaysShow: true,
    };

    const quickPick = vscode.window.createQuickPick();

    quickPick.items = items;
    quickPick.placeholder = "Enter a prompt to edit your code (⏎ to submit)";
    quickPick.title = this._getQuickPickTitle();
    quickPick.ignoreFocusOut = true;
    quickPick.value = injectedPrompt ?? "";

    quickPick.show();

    quickPick.onDidChangeValue(async (value) => {
      if (value !== "") {
        switch (true) {
          case value.endsWith("@"):
            // Bring up current file as the default option for a new file search
            const relativeFilename = vscode.workspace.asRelativePath(
              this.editorWhenOpened.document.uri,
            );

            quickPick.items = [
              { label: relativeFilename, description: "Current file" },
            ];

            break;

          case value.includes("@"):
            // Perform file search
            const lastAtIndex = value.lastIndexOf("@");
            const searchQuery = value.substring(lastAtIndex + 1);

            const searchResults = await vscode.workspace.findFiles(
              `**/${searchQuery}*`,
              undefined,
              QuickEdit.maxFileResults
            );

            if (searchResults.length > 0) {
              quickPick.items = searchResults.map((result) => ({
                label: vscode.workspace.asRelativePath(result),
              }));
            } else {
              quickPick.items = [{ label: "No results found" }];
            }
            break;

          default:
            if (!quickPick.items.includes(submitItem)) {
              quickPick.items = [submitItem];
            }
            break;
        }
      } else {
        quickPick.items = items;
      }
    });

    const selectedItem = await new Promise<vscode.QuickPickItem | undefined>(
      (resolve) => {
        quickPick.onDidAccept(() => {
          const selectedOption = quickPick.selectedItems[0];
          resolve(selectedOption);
          quickPick.dispose();
        });
      },
    );

    if (!selectedItem || selectedItem.label === QuickEditItemLabels.Submit) {
      return quickPick.value;
    }

    return selectedItem.label;
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
      case QuickEditItemLabels.History:
        prompt = (await this._showHistoryPicker()) ?? "";
        break;

      case QuickEditItemLabels.ContextProviders:
        this.contextProviderStr =
          (await this._showContextProviderPicker()) ?? "";
        this.run(injectedPrompt); // Recurse back to let the user write their prompt
        break;

      case QuickEditItemLabels.Model:
        const selectedModelTitle = await this._showModelPicker();

        if (selectedModelTitle) {
          this._curModelTitle = selectedModelTitle;
        }

        this.run(injectedPrompt); // Recurse back to let the user write their prompt
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
