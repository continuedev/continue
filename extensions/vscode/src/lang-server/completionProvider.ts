import { IDE, TabAutocompleteOptions } from "core";
import { AutocompleteLruCache } from "core/autocomplete/cache";
import { onlyWhitespaceAfterEndOfLine } from "core/autocomplete/charStream";
import {
  constructAutocompletePrompt,
  languageForFilepath,
} from "core/autocomplete/constructPrompt";
import {
  stopAtSimilarLine,
  streamWithNewLines,
} from "core/autocomplete/lineStream";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "core/autocomplete/parameters";
import { getTemplateForModel } from "core/autocomplete/templates";
import { ConfigHandler } from "core/config/handler";
import { streamLines } from "core/diff/util";
import OpenAI from "core/llm/llms/OpenAI";
import { logDevData } from "core/util/devdata";
import Handlebars from "handlebars";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { AutocompletePromptBuilder } from "./autocompletePromptBuilder";

const statusBarItemText = (enabled: boolean | undefined) =>
  enabled ? "$(check) Continue" : "$(circle-slash) Continue";

const statusBarItemTooltip = (enabled: boolean | undefined) =>
  enabled ? "Tab autocomplete is enabled" : "Click to enable tab autocomplete";

let lastStatusBar: vscode.StatusBarItem | undefined = undefined;
let statusBarFalseTimeout: NodeJS.Timeout | undefined = undefined;

function stopStatusBarLoading() {
  statusBarFalseTimeout = setTimeout(() => {
    setupStatusBar(true, false);
  }, 100);
}

export function setupStatusBar(
  enabled: boolean | undefined,
  loading?: boolean
) {
  if (loading !== false) {
    clearTimeout(statusBarFalseTimeout);
    statusBarFalseTimeout = undefined;
  }

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

export interface AutocompleteOutcome {
  accepted?: boolean;
  time: number;
  prompt: string;
  completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
  cacheHit: boolean;
}

const autocompleteCache = AutocompleteLruCache.get();

class ListenableGenerator<T> {
  private _source: AsyncGenerator<T>;
  private _buffer: T[] = [];
  private _listeners: Set<(value: T) => void> = new Set();
  private _isEnded: boolean = false;

  constructor(source: AsyncGenerator<T>) {
    this._source = source;
    this._start();
  }

  public cancel() {
    this._isEnded = true;
  }

  private async _start() {
    try {
      for await (const value of this._source) {
        if (this._isEnded) {
          break;
        }
        this._buffer.push(value);
        for (const listener of this._listeners) {
          listener(value);
        }
      }
    } finally {
      this._isEnded = true;
      for (const listener of this._listeners) {
        listener(null as any);
      }
    }
  }

  listen(listener: (value: T) => void) {
    this._listeners.add(listener);
    for (const value of this._buffer) {
      listener(value);
    }
    if (this._isEnded) {
      listener(null as any);
    }
  }

  async *tee(): AsyncGenerator<T> {
    try {
      for (const value of this._buffer) {
        yield value;
      }
      while (!this._isEnded) {
        let resolve: (value: any) => void;
        let promise = new Promise<T>((res) => {
          resolve = res;
          this._listeners.add(resolve!);
        });
        const value = await promise;
        this._listeners.delete(resolve!);

        yield value;
      }
    } finally {
      // this._listeners.delete(resolve!);
    }
  }
}

class GeneratorReuseManager {
  static currentGenerator: ListenableGenerator<string> | undefined;
  static pendingGeneratorPrefix: string | undefined;
  static pendingCompletion: string = "";

  private static _createListenableGenerator(
    gen: AsyncGenerator<string>,
    prefix: string
  ) {
    GeneratorReuseManager.currentGenerator?.cancel();

    const listenableGen = new ListenableGenerator(gen);
    listenableGen.listen(
      (chunk) => (GeneratorReuseManager.pendingCompletion += chunk ?? "")
    );

    GeneratorReuseManager.pendingGeneratorPrefix = prefix;
    GeneratorReuseManager.pendingCompletion = "";
    GeneratorReuseManager.currentGenerator = listenableGen;
  }

  static async *getGenerator(
    prefix: string,
    newGenerator: () => AsyncGenerator<string>
  ): AsyncGenerator<string> {
    // Check if current can be reused
    if (
      !(
        GeneratorReuseManager.currentGenerator &&
        GeneratorReuseManager.pendingGeneratorPrefix &&
        (
          GeneratorReuseManager.pendingGeneratorPrefix +
          GeneratorReuseManager.pendingCompletion
        ).startsWith(prefix) &&
        // for e.g. backspace
        GeneratorReuseManager.pendingGeneratorPrefix?.length <= prefix?.length
      )
    ) {
      // Create a wrapper over the current generator to fix the prompt
      GeneratorReuseManager._createListenableGenerator(newGenerator(), prefix);
    }

    let alreadyTyped =
      prefix.slice(GeneratorReuseManager.pendingGeneratorPrefix?.length) || "";
    for await (let chunk of GeneratorReuseManager.currentGenerator!.tee()) {
      if (!chunk) {
        continue;
      }
      while (chunk.length && alreadyTyped.length) {
        if (chunk[0] === alreadyTyped[0]) {
          alreadyTyped = alreadyTyped.slice(1);
          chunk = chunk.slice(1);
        } else {
          break;
        }
      }
      yield chunk;
    }
  }
}

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private static debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private static debouncing: boolean = false;
  private static lastUUID: string | undefined = undefined;

  public static errorsShown: Set<string> = new Set();

  private readonly promptBuilder: AutocompletePromptBuilder;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly tabAutocompleteModel: TabAutocompleteModel
  ) {
    this.promptBuilder = new AutocompletePromptBuilder(ide);
  }

  async getTabCompletion(
    document: vscode.TextDocument,
    pos: vscode.Position,
    token: vscode.CancellationToken,
    options: TabAutocompleteOptions
  ): Promise<AutocompleteOutcome | undefined> {
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
      const llm = await this.tabAutocompleteModel.get();
      if (llm instanceof OpenAI) {
        llm.useLegacyCompletionsEndpoint = true;
      }
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
      const lineBelowCursor = document.lineAt(
        Math.min(pos.line + 1, document.lineCount - 1)
      ).text;
      const clipboardText = await vscode.env.clipboard.readText();
      const { prefix, suffix } = await constructAutocompletePrompt(
        document.uri.toString(),
        fullPrefix,
        fullSuffix,
        clipboardText,
        lang,
        this.promptBuilder.getDefinition,
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
      let cacheHit = false;
      if (cachedCompletion) {
        // Cache
        cacheHit = true;
        completion = cachedCompletion;
      } else {
        setupStatusBar(true, true);

        // Try to reuse pending requests if what the user typed matches start of completion
        let stop = [
          ...(completionOptions?.stop || []),
          "\n\n",
          "```",
          ...lang.stopWords,
        ];
        if (options.disableMultiLineCompletions) {
          stop.unshift("\n");
        }
        let generator = GeneratorReuseManager.getGenerator(prefix, () =>
          llm.streamComplete(prompt, {
            ...completionOptions,
            temperature: 0,
            raw: true,
            stop,
          })
        );

        // LLM
        let cancelled = false;
        const generatorWithCancellation = async function* () {
          for await (const update of generator) {
            if (token.isCancellationRequested) {
              stopStatusBarLoading();
              cancelled = true;
              return undefined;
            }
            yield update;
          }
        };
        const gen2 = onlyWhitespaceAfterEndOfLine(
          generatorWithCancellation(),
          lang.endOfLine
        );
        const lineGenerator = streamWithNewLines(streamLines(gen2));
        const finalGenerator = stopAtSimilarLine(
          lineGenerator,
          lineBelowCursor
        );
        for await (const update of finalGenerator) {
          completion += update;
        }

        if (cancelled) {
          return undefined;
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
        cacheHit,
      };
    } catch (e: any) {
      console.warn("Error generating autocompletion: ", e);
      if (!ContinueCompletionProvider.errorsShown.has(e.message)) {
        ContinueCompletionProvider.errorsShown.add(e.message);
        vscode.window
          .showErrorMessage(e.message, "Documentation")
          .then((val) => {
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
      const outcome = await this.getTabCompletion(
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
        if (!outcome.cacheHit) {
          (await autocompleteCache).put(outcome.prompt, completion);
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
          }
        ),
      ];
    } catch (e: any) {
      console.warn("Error getting autocompletion: ", e.message);
    } finally {
      stopStatusBarLoading();
    }
  }
}
