import { IDE } from "core";
import AutocompleteLruCache from "core/autocomplete/cache";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "core/autocomplete/parameters";
import { GeneratorReuseManager } from "core/autocomplete/util";
import { ConfigHandler } from "core/config/handler";
import { logDevData } from "core/util/devdata";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { getTabCompletion } from "./getTabCompletion";
import { stopStatusBarLoading } from "./statusBar";

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private static debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private static debouncing: boolean = false;
  private static lastUUID: string | undefined = undefined;

  private generatorReuseManager = new GeneratorReuseManager((err: any) => {
    vscode.window.showErrorMessage(
      `Error generating autocomplete response: ${err}`,
    );
  });
  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly tabAutocompleteModel: TabAutocompleteModel,
  ) {}

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    // Debounce
    const uuid = uuidv4();
    ContinueCompletionProvider.lastUUID = uuid;

    const config = await this.configHandler.loadConfig();
    const options = {
      ...config.tabAutocompleteOptions,
      ...DEFAULT_AUTOCOMPLETE_OPTS,
    };

    if (ContinueCompletionProvider.debouncing) {
      ContinueCompletionProvider.debounceTimeout?.refresh();
      const lastUUID = await new Promise((resolve) =>
        setTimeout(() => {
          resolve(ContinueCompletionProvider.lastUUID);
        }, options.debounceDelay),
      );
      if (uuid !== lastUUID) {
        return [];
      }
    } else {
      ContinueCompletionProvider.debouncing = true;
      ContinueCompletionProvider.debounceTimeout = setTimeout(async () => {
        ContinueCompletionProvider.debouncing = false;
      }, options.debounceDelay);
    }

    const enableTabAutocomplete =
      vscode.workspace
        .getConfiguration("continue")
        .get<boolean>("enableTabAutocomplete") || false;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return [];
    }

    try {
      const outcome = await getTabCompletion(
        document,
        position,
        token,
        options,
        this.tabAutocompleteModel,
        this.ide,
        this.generatorReuseManager,
      );
      const completion = outcome?.completion;

      if (!completion) {
        return [];
      }

      // Do some stuff later so as not to block return. Latency matters
      setTimeout(async () => {
        if (!outcome.cacheHit) {
          (await this.autocompleteCache).put(outcome.prompt, completion);
        }
      }, 100);

      const logRejectionTimeout = setTimeout(() => {
        // Wait 10 seconds, then assume it wasn't accepted
        outcome.accepted = false;
        logDevData("autocomplete", outcome);
      }, 10_000);

      return [
        new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, position.translate(0, completion.length)),
          {
            title: "Log Autocomplete Outcome",
            command: "continue.logAutocompleteOutcome",
            arguments: [outcome, logRejectionTimeout],
          },
        ),
      ];
    } catch (e: any) {
      console.warn("Error generating autocompletion: ", e);
      if (!this.errorsShown.has(e.message)) {
        this.errorsShown.add(e.message);
        vscode.window
          .showErrorMessage(e.message, "Documentation")
          .then((val) => {
            if (val === "Documentation") {
              vscode.env.openExternal(
                vscode.Uri.parse(
                  "https://continue.dev/docs/walkthroughs/tab-autocomplete",
                ),
              );
            }
          });
      }
    } finally {
      stopStatusBarLoading();
    }
  }
}
