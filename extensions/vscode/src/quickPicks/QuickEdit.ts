import { IDE } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { fetchwithRequestOptions } from "core/util/fetchWithOptions";
import * as vscode from "vscode";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import { Telemetry } from "core/util/posthog";

interface QuickEditConfig {
  defaultModelTitle: string;
  previousInput?: string;
  injectedPrompt?: string;
}

export class QuickEdit {
  private static historyKey = "quickEditHistory";
  private static maxHistoryLength = 50;
  private contextProviderStr?: string;

  constructor(
    private readonly verticalDiffManager: VerticalPerLineDiffManager,
    private readonly configHandler: ConfigHandler,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: IDE,
    private readonly context: vscode.ExtensionContext,
  ) {}

  private async _getDefaultModelTitle(): Promise<string> {
    const config = await this.configHandler.loadConfig();

    let defaultModelTitle =
      config.experimental?.modelRoles?.inlineEdit ??
      (await this.webviewProtocol.request("getDefaultModelTitle", undefined));

    if (!defaultModelTitle) {
      defaultModelTitle = config.models[0]?.title!;
    }
    return defaultModelTitle;
  }

  /**
   * Gets the title for the quick pick menu based on the active text editor's selection.
   *
   * @returns The title for the quick pick menu, which includes the file name and line numbers if a selection is made.
   *
   * Examples:
   * - If no text is selected: "Edit"
   * - If multiple lines are selected: "Edit file.ts:10-12"
   * - If a single line is selected: "Edit file.ts:10"
   */
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
    const contextProviders = (await this.configHandler.loadConfig())
      .contextProviders;

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

  private async _getQuickEditConfig(
    injectedPrompt: string | undefined,
  ): Promise<QuickEditConfig> {
    const editor = vscode.window.activeTextEditor;

    const existingHandler = this.verticalDiffManager.getHandlerForFile(
      editor?.document.uri.fsPath ?? "",
    );

    const previousInput = existingHandler?.input;

    const context: QuickEditConfig = {
      defaultModelTitle: await this._getDefaultModelTitle(),
      previousInput,
      injectedPrompt,
    };

    return context;
  }

  private async _showContextProviderPicker() {
    const contextProviderItems = await this._getContextProviderItems();

    const quickPick = vscode.window.createQuickPick();

    quickPick.items = contextProviderItems;
    quickPick.title = "Context providers";
    quickPick.placeholder = "Select a context provider to add to your prompt";
    quickPick.canSelectMany = true;
    quickPick.buttons = [vscode.QuickInputButtons.Back];

    quickPick.show();

    const val = await new Promise<string | undefined>((resolve, reject) => {
      quickPick.onDidTriggerButton((item) => {
        resolve(undefined);
      });

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
    const llm = await this.configHandler.llmFromTitle();
    const config = await this.configHandler.loadConfig();

    const contextItems = (
      await Promise.all(
        selectedProviders?.map((selectedProvider) => {
          const provider = config.contextProviders?.find(
            (provider) =>
              provider.description.displayTitle === selectedProvider.label,
          );

          if (!provider) {
            return [];
          }

          return provider.getContextItems("", {
            embeddingsProvider: config.embeddingsProvider,
            reranker: config.reranker,
            ide: this.ide,
            llm,
            fullInput: "",
            selectedCode: [],
            fetch: (url, init) =>
              fetchwithRequestOptions(url, init, config.requestOptions),
          });
        }) || [],
      )
    ).flat();

    return (
      contextItems.map((item) => item.content).join("\n\n") + "\n\n---\n\n"
    );
  }

  private async _streamEditWithInputAndContext(
    prompt: string,
    context: QuickEditConfig,
  ) {
    if (this.contextProviderStr) {
      prompt = `${this.contextProviderStr}${prompt}`;
    }

    this.webviewProtocol.request("incrementFtc", undefined);

    await this.verticalDiffManager.streamEdit(
      prompt,
      context.defaultModelTitle,
      undefined,
      context.previousInput,
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

  // TODO: Add a back button using `createQuickPick`
  async _showHistoryPicker(): Promise<string | undefined> {
    const historyItems = this.context.globalState
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
    context: QuickEditConfig,
  ): Promise<string | undefined> {
    const items = [
      {
        label: "History",
        detail: "$(history) Select previous prompts",
      },
      {
        label: "Context providers",
        detail: "$(terminal-new) Add context to your prompt",
      },
    ];

    const submitItem: vscode.QuickPickItem = {
      label: "Submit",
      detail: "Submit your prompt",
      alwaysShow: true,
    };

    const quickPick = vscode.window.createQuickPick();

    quickPick.items = items;
    quickPick.placeholder = "Enter a prompt to edit your code (⏎ to submit)";
    quickPick.title = this._getQuickPickTitle();
    quickPick.ignoreFocusOut = true;
    quickPick.value = context.injectedPrompt ?? "";

    quickPick.show();

    quickPick.onDidChangeValue(async (value) => {
      if (value) {
        if (!quickPick.items.includes(submitItem)) {
          quickPick.items = [...quickPick.items, submitItem];
        }
      } else {
        quickPick.items = quickPick.items.slice(0, -1);
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

    if (!selectedItem || selectedItem.label === "Submit") {
      return quickPick.value;
    }

    return selectedItem?.label;
  }

  async run(injectedPrompt?: string) {
    const context = await this._getQuickEditConfig(injectedPrompt);
    const quickPickItemOrInput = await this._showInitialQuickPick(context);

    let prompt: string | undefined = undefined;

    switch (quickPickItemOrInput) {
      case "History":
        Telemetry.capture("quickEditSelection", {
          selection: quickPickItemOrInput,
        });

        prompt = (await this._showHistoryPicker()) ?? "";
        break;

      case "Context providers":
        Telemetry.capture("quickEditSelection", {
          selection: quickPickItemOrInput,
        });

        this.contextProviderStr =
          (await this._showContextProviderPicker()) ?? "";

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
      await this._streamEditWithInputAndContext(prompt, context);
    }
  }
}
