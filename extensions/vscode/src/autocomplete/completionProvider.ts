import type { IDE } from "core";
import {
  type AutocompleteInput,
  CompletionProvider,
  type AutocompleteInput,
} from "core/autocomplete/completionProvider";
import type { ConfigHandler } from "core/config/handler";
import { logDevData } from "core/util/devdata";
import { Telemetry } from "core/util/posthog";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import type { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { getDefinitionsFromLsp } from "./lsp";
import { RecentlyEditedTracker } from "./recentlyEdited";
import { setupStatusBar, stopStatusBarLoading } from "./statusBar";

interface VsCodeCompletionInput {
  document: vscode.TextDocument;
  position: vscode.Position;
  context: vscode.InlineCompletionContext;
}

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private onError(e: any) {
    const options = ["Documentation"];
    if (e.message.includes("https://ollama.ai")) {
      options.push("Download Ollama");
    }
    vscode.window.showErrorMessage(e.message, ...options).then((val) => {
      if (val === "Documentation") {
        vscode.env.openExternal(
          vscode.Uri.parse(
            "https://docs.continue.dev/walkthroughs/tab-autocomplete",
          ),
        );
      } else if (val === "Download Ollama") {
        vscode.env.openExternal(vscode.Uri.parse("https://ollama.ai"));
      }
    });
  }

  private completionProvider: CompletionProvider;
  private recentlyEditedTracker = new RecentlyEditedTracker();

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly tabAutocompleteModel: TabAutocompleteModel,
  ) {
    this.completionProvider = new CompletionProvider(
      this.configHandler,
      this.ide,
      this.tabAutocompleteModel.get.bind(this.tabAutocompleteModel),
      this.onError.bind(this),
      getDefinitionsFromLsp,
    );

    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.fsPath === this._lastShownCompletion?.filepath) {
        // console.log("updating completion");
      }
    });
  }

  _lastShownCompletion: AutocompleteOutcome | undefined;

  _lastVsCodeCompletionInput: VsCodeCompletionInput | undefined;

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    const enableTabAutocomplete =
      vscode.workspace
        .getConfiguration("continue")
        .get<boolean>("enableTabAutocomplete") || false;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return null;
    }

    // If the text at the range isn't a prefix of the intellisense text,
    // no completion will be displayed, regardless of what we return
    if (
      context.selectedCompletionInfo &&
      !context.selectedCompletionInfo.text.startsWith(
        document.getText(context.selectedCompletionInfo.range),
      )
    ) {
      return null;
    }

    let injectDetails: string | undefined = undefined;
    // Here we could use the details from the intellisense dropdown
    // and place them just above the line being typed but because
    // we don't have control over the formatting of the details and
    // they could be especially long, not doing this for now
    // if (context.selectedCompletionInfo) {
    //   const results: any = await vscode.commands.executeCommand(
    //     "vscode.executeCompletionItemProvider",
    //     document.uri,
    //     position,
    //     null,
    //     1,
    //   );
    //   if (results?.items) {
    //     injectDetails = results.items?.[0]?.detail;
    //     // const label = results?.items?.[0].label;
    //     // const workspaceSymbols = (
    //     //   (await vscode.commands.executeCommand(
    //     //     "vscode.executeWorkspaceSymbolProvider",
    //     //     label,
    //     //   )) as any
    //     // ).filter((symbol: any) => symbol.name === label);
    //     // console.log(label, "=>", workspaceSymbols);
    //   }
    // }

    // The first time intellisense dropdown shows up, and the first choice is selected,
    // we should not consider this. Only once user explicitly moves down the list
    const newVsCodeInput = {
      context,
      document,
      position,
    };
    const selectedCompletionInfo = context.selectedCompletionInfo;
    this._lastVsCodeCompletionInput = newVsCodeInput;

    try {
      const abortController = new AbortController();
      const signal = abortController.signal;
      token.onCancellationRequested(() => abortController.abort());

      const config = await this.configHandler.loadConfig();
      let clipboardText = "";
      if (config.tabAutocompleteOptions?.useCopyBuffer === true) {
        clipboardText = await vscode.env.clipboard.readText();
      }

      // Handle notebook cells
      const pos = {
        line: position.line,
        character: position.character,
      };
      let manuallyPassFileContents: string | undefined = undefined;
      if (document.uri.scheme === "vscode-notebook-cell") {
        const notebook = vscode.workspace.notebookDocuments.find((notebook) =>
          notebook
            .getCells()
            .some((cell) => cell.document.uri === document.uri),
        );
        if (notebook) {
          const cells = notebook.getCells();
          manuallyPassFileContents = cells
            .map((cell) => cell.document.getText())
            .join("\n\n");
          for (const cell of cells) {
            if (cell.document.uri === document.uri) {
              break;
            } else {
              pos.line += cell.document.getText().split("\n").length + 1;
            }
          }
        }
      }
      const input: AutocompleteInput = {
        completionId: uuidv4(),
        filepath: document.uri.fsPath,
        pos,
        recentlyEditedFiles: [],
        recentlyEditedRanges: [],
        clipboardText: clipboardText,
        manuallyPassFileContents,
      };

      setupStatusBar(true, true);
      const outcome =
        await this.completionProvider.provideInlineCompletionItems(
          input,
          signal,
        );

      if (!outcome || !outcome.completion) {
        return null;
      }

      // VS Code displays dependent on selectedCompletionInfo (their docstring below)
      // We should first always make sure we have a valid completion, but if it goes wrong we
      // want telemetry to be correct
      /**
       * Provides information about the currently selected item in the autocomplete widget if it is visible.
       *
       * If set, provided inline completions must extend the text of the selected item
       * and use the same range, otherwise they are not shown as preview.
       * As an example, if the document text is `console.` and the selected item is `.log` replacing the `.` in the document,
       * the inline completion must also replace `.` and start with `.log`, for example `.log()`.
       *
       * Inline completion providers are requested again whenever the selected item changes.
       */
      if (selectedCompletionInfo) {
        outcome.completion = selectedCompletionInfo.text + outcome.completion;
      }
      const willDisplay = this.willDisplay(
        document,
        selectedCompletionInfo,
        signal,
        outcome,
      );
      if (!willDisplay) {
        return null;
      }

      return [
        new vscode.InlineCompletionItem(
          outcome.completion,
          new vscode.Range(
            position,
            position.translate(0, outcome.completion.length),
          ),
          {
            title: "Log Autocomplete Outcome",
            command: "continue.logAutocompleteOutcome",
            arguments: [outcome, logRejectionTimeout],
          },
        ),
      ];
    } finally {
      stopStatusBarLoading();
    }
  }

  willDisplay(
    document: vscode.TextDocument,
    selectedCompletionInfo: vscode.SelectedCompletionInfo | undefined,
    abortSignal: AbortSignal,
    outcome: AutocompleteOutcome,
  ): boolean {
    if (selectedCompletionInfo) {
      const { text, range } = selectedCompletionInfo;
      if (!outcome.completion.startsWith(text)) {
        console.log(
          `Won't display completion because text doesn't match: ${text}, ${outcome.completion}`,
          range,
        );
        return false;
      }
    }

    if (abortSignal.aborted) {
      return false;
    }

    return true;
  }
}
