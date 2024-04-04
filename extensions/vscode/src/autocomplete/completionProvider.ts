import { IDE } from "core";
import {
  AutocompleteInput,
  CompletionProvider,
} from "core/autocomplete/completionProvider";
import { ConfigHandler } from "core/config/handler";
import { logDevData } from "core/util/devdata";
import { Telemetry } from "core/util/posthog";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { getDefinitionsFromLsp } from "./lsp";
import { setupStatusBar, stopStatusBarLoading } from "./statusBar";

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private onError(e: any) {
    vscode.window.showErrorMessage(e.message, "Documentation").then((val) => {
      if (val === "Documentation") {
        vscode.env.openExternal(
          vscode.Uri.parse(
            "https://continue.dev/docs/walkthroughs/tab-autocomplete"
          )
        );
      }
    });
  }

  private completionProvider: CompletionProvider;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly tabAutocompleteModel: TabAutocompleteModel
  ) {
    this.completionProvider = new CompletionProvider(
      this.configHandler,
      this.ide,
      this.tabAutocompleteModel.get.bind(this.tabAutocompleteModel),
      this.onError.bind(this),
      getDefinitionsFromLsp
    );
  }

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    const enableTabAutocomplete =
      vscode.workspace
        .getConfiguration("continue")
        .get<boolean>("enableTabAutocomplete") || false;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return [];
    }

    try {
      const abortController = new AbortController();
      const signal = abortController.signal;
      token.onCancellationRequested(() => abortController.abort());

      const config = await this.configHandler.loadConfig();
      let clipboardText = "";
      if (config.tabAutocompleteOptions?.useCopyBuffer === true) {
        clipboardText = await vscode.env.clipboard.readText();
      }

      const input: AutocompleteInput = {
        completionId: uuidv4(),
        filepath: document.uri.fsPath,
        pos: { line: position.line, character: position.character },
        recentlyEditedFiles: [],
        recentlyEditedRanges: [],
        clipboardText: clipboardText
      };

      setupStatusBar(true, true);
      const outcome =
        await this.completionProvider.provideInlineCompletionItems(
          input,
          signal
        );

      if (!outcome || !outcome.completion) {
        return [];
      }

      const logRejectionTimeout = setTimeout(() => {
        // Wait 10 seconds, then assume it wasn't accepted
        outcome.accepted = false;
        logDevData("autocomplete", outcome);
        Telemetry.capture("autocomplete", {
          accepted: outcome.accepted,
          modelName: outcome.modelName,
          modelProvider: outcome.modelProvider,
          time: outcome.time,
          cacheHit: outcome.cacheHit,
        });
      }, 10_000);

      return [
        new vscode.InlineCompletionItem(
          outcome.completion,
          new vscode.Range(
            position,
            position.translate(0, outcome.completion.length)
          ),
          {
            title: "Log Autocomplete Outcome",
            command: "continue.logAutocompleteOutcome",
            arguments: [outcome, logRejectionTimeout],
          }
        ),
      ];
    } finally {
      stopStatusBarLoading();
    }
  }
}
