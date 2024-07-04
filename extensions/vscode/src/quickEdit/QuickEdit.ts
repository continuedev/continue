import { IDE } from "core";
import { ConfigHandler } from "core/config/handler";
import { fetchwithRequestOptions } from "core/util/fetchWithOptions";
import * as vscode from "vscode";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { getPlatform } from "../util/util";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import InputBoxWithHistory from "./InputBoxWithHistory";

interface QuickEditFlowStuff {
  defaultModelTitle: string;
  quickPickItems: vscode.QuickPickItem[];
  previousInput: string | undefined;
  injectedPrompt?: string | undefined;
}

export class QuickEdit {
  constructor(
    private readonly verticalDiffManager: VerticalPerLineDiffManager,
    private readonly configHandler: ConfigHandler,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: IDE,
    private readonly context: vscode.ExtensionContext,
    private readonly historyUpEvent: vscode.Event<void>,
    private readonly historyDownEvent: vscode.Event<void>,
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

  private async _getQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const contextProviders = (await this.configHandler.loadConfig())
      .contextProviders;
    const quickPickItems =
      contextProviders
        ?.filter((provider) => provider.description.type === "normal")
        .map((provider) => {
          return {
            label: provider.description.displayTitle,
            description: provider.description.title,
            detail: provider.description.description,
          };
        }) || [];
    return quickPickItems;
  }

  private async _getStuff(
    injectedPrompt: string | undefined,
  ): Promise<QuickEditFlowStuff> {
    const editor = vscode.window.activeTextEditor;
    const existingHandler = this.verticalDiffManager.getHandlerForFile(
      editor?.document.uri.fsPath ?? "",
    );
    const previousInput = existingHandler?.input;
    const stuff: QuickEditFlowStuff = {
      defaultModelTitle: await this._getDefaultModelTitle(),
      quickPickItems: await this._getQuickPickItems(),
      previousInput,
      injectedPrompt,
    };
    return stuff;
  }

  async _getTextInputOptions(stuff: QuickEditFlowStuff) {
    const selectionEmpty = vscode.window.activeTextEditor?.selection.isEmpty;
    const addContextMsg = stuff.quickPickItems.length
      ? " (or press enter to add context first)"
      : "";
    const textInputOptions: vscode.InputBoxOptions = {
      placeHolder: selectionEmpty
        ? `Type instructions to generate code${addContextMsg}`
        : `Describe how to edit the highlighted code${addContextMsg}`,
      title: `${getPlatform() === "mac" ? "Cmd" : "Ctrl"}+I`,
      prompt: `[${stuff.defaultModelTitle}]`,
      value: stuff.injectedPrompt,
      ignoreFocusOut: true,
    };
    if (stuff.previousInput) {
      textInputOptions.value = stuff.previousInput + ", ";
      textInputOptions.valueSelection = [
        textInputOptions.value.length,
        textInputOptions.value.length,
      ];
    }
    return textInputOptions;
  }

  async _collectTextInput(
    stuff: QuickEditFlowStuff,
  ): Promise<string | undefined> {
    const inputBox = new InputBoxWithHistory(
      this.context,
      this.historyUpEvent,
      this.historyDownEvent,
      await this._getTextInputOptions(stuff),
    );
    const input = await inputBox.getInput();
    inputBox.dispose();
    return input;
  }

  private async _runWithContextItems(stuff: QuickEditFlowStuff) {
    const selectedProviders = await vscode.window.showQuickPick(
      stuff.quickPickItems,
      {
        title: "Add Context",
        canPickMany: true,
      },
    );

    const input = await this._collectTextInput(stuff);
    if (input) {
      const inputWithContext = await this._addSelectedProvidersToInput(
        input,
        selectedProviders,
      );

      await this._sendRequest(inputWithContext, stuff);
    }
  }

  private async _addSelectedProvidersToInput(
    input: string,
    selectedProviders: vscode.QuickPickItem[] | undefined,
  ): Promise<string> {
    const llm = await this.configHandler.llmFromTitle();
    const config = await this.configHandler.loadConfig();
    const context = (
      await Promise.all(
        selectedProviders?.map((providerTitle) => {
          const provider = config.contextProviders?.find(
            (provider) =>
              provider.description.title === providerTitle.description,
          );
          if (!provider) {
            return [];
          }

          return provider.getContextItems("", {
            embeddingsProvider: config.embeddingsProvider,
            reranker: config.reranker,
            ide: this.ide,
            llm,
            fullInput: input || "",
            selectedCode: [],
            fetch: (url, init) =>
              fetchwithRequestOptions(url, init, config.requestOptions),
          });
        }) || [],
      )
    ).flat();

    return (
      context.map((item) => item.content).join("\n\n") + "\n\n---\n\n" + input
    );
  }

  private async _handleInitialInput(
    initialInput: string | undefined,
    stuff: QuickEditFlowStuff,
  ) {
    // If the user presses enter, we take them to context items selector
    if (initialInput?.length === 0 && stuff.quickPickItems.length > 0) {
      await this._runWithContextItems(stuff);
    } else if (initialInput) {
      // If there's input, then start generating the diff
      await this._sendRequest(initialInput, stuff);
    }
  }

  private async _sendRequest(input: string, stuff: QuickEditFlowStuff) {
    this.webviewProtocol.request("incrementFtc", undefined);
    await this.verticalDiffManager.streamEdit(
      input,
      stuff.defaultModelTitle,
      undefined,
      stuff.previousInput,
    );
  }

  async run(injectedPrompt: string | undefined) {
    const stuff = await this._getStuff(injectedPrompt);
    const initialInput = await this._collectTextInput(stuff);
    await this._handleInitialInput(initialInput, stuff);
  }
}
