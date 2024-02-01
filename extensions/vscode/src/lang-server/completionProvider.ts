import { TabAutocompleteOptions } from "core";
import { AutocompleteLruCache } from "core/autocomplete/cache";
import {
  AutocompleteSnippet,
  constructAutocompletePrompt,
  languageForFilepath,
} from "core/autocomplete/constructPrompt";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "core/autocomplete/parameters";
import { getTemplateForModel } from "core/autocomplete/templates";
import Handlebars from "handlebars";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { ideProtocolClient } from "../activation/activate";
import { VsCodeIde } from "../ideProtocol";
import { TabAutocompleteModel, configHandler } from "../loadConfig";

const statusBarItemText = (enabled: boolean | undefined) =>
  enabled ? "$(check) Continue" : "$(circle-slash) Continue";

const statusBarItemTooltip = (enabled: boolean | undefined) =>
  enabled ? "Tab autocomplete is enabled" : "Click to enable tab autocomplete";

let lastStatusBar: vscode.StatusBarItem | undefined = undefined;
export function setupStatusBar(
  enabled: boolean | undefined,
  loading?: boolean
) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  statusBarItem.text = loading
    ? "$(loading~spin) Continue"
    : statusBarItemText(enabled);
  statusBarItem.tooltip = statusBarItemTooltip(enabled);
  statusBarItem.command = "continue.toggleTabAutocompleteEnabled";

  // Swap out with old status bar
  if (lastStatusBar) {
    lastStatusBar.dispose();
  }
  statusBarItem.show();
  lastStatusBar = statusBarItem;

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("continue")) {
      const config = vscode.workspace.getConfiguration("continue");
      const enabled = config.get<boolean>("enableTabAutocomplete");
      statusBarItem.dispose();
      setupStatusBar(enabled);
    }
  });
}

async function getDefinition(
  filepath: string,
  line: number,
  character: number
): Promise<AutocompleteSnippet | undefined> {
  const definitions = (await vscode.commands.executeCommand(
    "vscode.executeDefinitionProvider",
    vscode.Uri.file(filepath),
    new vscode.Position(line, character)
  )) as any;

  if (definitions[0]?.targetRange) {
    return {
      filepath,
      content: await ideProtocolClient.readRangeInFile(
        definitions[0].targetUri.fsPath,
        definitions[0].targetRange
      ),
    };
  }

  return undefined;
}

export interface AutocompleOutcome {
  accepted?: boolean;
  time: number;
  prompt: string;
  completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
}

const autocompleteCache = AutocompleteLruCache.get();

async function getTabCompletion(
  document: vscode.TextDocument,
  pos: vscode.Position,
  token: vscode.CancellationToken,
  options: TabAutocompleteOptions
): Promise<AutocompleOutcome | undefined> {
  const startTime = Date.now();

  // Filter
  const lang = languageForFilepath(document.fileName);
  const line = document.lineAt(pos).text;
  for (const endOfLine of lang.endOfLine) {
    if (line.endsWith(endOfLine) && pos.character >= endOfLine.length) {
      return undefined;
    }
  }

  try {
    // Model
    const llm = await TabAutocompleteModel.get();
    if (!llm) return;

    // Prompt
    const fullPrefix = document.getText(
      new vscode.Range(new vscode.Position(0, 0), pos)
    );
    const fullSuffix = document.getText(
      new vscode.Range(
        pos,
        new vscode.Position(document.lineCount, Number.MAX_SAFE_INTEGER)
      )
    );
    const clipboardText = await vscode.env.clipboard.readText();
    const { prefix, suffix } = await constructAutocompletePrompt(
      document.fileName,
      fullPrefix,
      fullSuffix,
      clipboardText,
      lang,
      getDefinition,
      options
    );

    const { template, completionOptions } = options.template
      ? { template: options.template, completionOptions: {} }
      : getTemplateForModel(llm.model);

    const compiledTemplate = Handlebars.compile(template);
    const prompt = compiledTemplate({ prefix, suffix });

    // Completion
    let completion = "";

    const cache = await autocompleteCache;
    const cachedCompletion = await cache.get(prompt);
    if (cachedCompletion) {
      // Cache
      completion = cachedCompletion;
    } else {
      setupStatusBar(true, true);

      // LLM
      for await (const update of llm.streamComplete(prompt, {
        ...completionOptions,
        temperature: 0,
        raw: true,
        stop: [
          ...(completionOptions?.stop || []),
          "\n\n",
          "```",
          ...lang.stopWords,
        ],
      })) {
        completion += update;
        if (token.isCancellationRequested) {
          return undefined;
        }

        let foundEndLine = false;
        for (const end of lang.endOfLine) {
          if (completion.includes(end + "\n")) {
            completion =
              completion.slice(0, completion.indexOf(end + "\n")) + end;
            foundEndLine = true;
            break;
          }
        }
        if (foundEndLine) {
          break;
        }
      }

      // Don't return empty
      if (completion.trim().length <= 0) {
        return undefined;
      }

      // Post-processing
      completion = completion.trimEnd();
    }

    const time = Date.now() - startTime;
    return {
      time,
      completion,
      prompt,
      modelProvider: llm.providerName,
      modelName: llm.model,
      completionOptions,
    };
  } catch (e: any) {
    console.warn("Error generating autocompletion: ", e);
    if (!ContinueCompletionProvider.errorsShown.has(e.message)) {
      ContinueCompletionProvider.errorsShown.add(e.message);
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
    return undefined;
  }
}

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private static debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private static debouncing: boolean = false;
  private static lastUUID: string | undefined = undefined;

  public static errorsShown: Set<string> = new Set();

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    // Debounce
    const uuid = uuidv4();
    ContinueCompletionProvider.lastUUID = uuid;

    const config = await configHandler.loadConfig(new VsCodeIde());
    const options = {
      ...config.tabAutocompleteOptions,
      ...DEFAULT_AUTOCOMPLETE_OPTS,
    };

    if (ContinueCompletionProvider.debouncing) {
      ContinueCompletionProvider.debounceTimeout?.refresh();
      const lastUUID = await new Promise((resolve) =>
        setTimeout(() => {
          resolve(ContinueCompletionProvider.lastUUID);
        }, options.debounceDelay)
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
        options
      );
      const completion = outcome?.completion;

      if (!completion) {
        return [];
      }

      // Do some stuff later so as not to block return. Latency matters
      setTimeout(async () => {
        (await autocompleteCache).put(outcome.prompt, completion);
      }, 100);

      const logRejectionTimeout = setTimeout(() => {
        // Wait 10 seconds, then assume it wasn't accepted
        outcome.accepted = false;
        ideProtocolClient.logDevData("autocomplete", outcome);
      }, 10_000);

      return [
        new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, position.translate(0, completion.length)),
          {
            title: "Log Autocomplete Outcome",
            command: "continue.logAutocompleteOutcome",
            arguments: [outcome, logRejectionTimeout],
          }
        ),
      ];
    } catch (e: any) {
      console.warn("Error getting autocompletion: ", e.message);
    } finally {
      setupStatusBar(true, false);
    }
  }
}
