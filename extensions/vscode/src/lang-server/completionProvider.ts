import { AutocompleteLruCache } from "core/autocomplete/cache";
import {
  constructAutocompletePrompt,
  languageForFilepath,
} from "core/autocomplete/constructPrefix";
import { DEBOUNCE_DELAY } from "core/autocomplete/parameters";
import { getTemplateForModel } from "core/autocomplete/templates";
import Handlebars from "handlebars";
import { v4 as uuidv4 } from "uuid";
import {
  CancellationToken,
  InlineCompletionContext,
  InlineCompletionItem,
  InlineCompletionItemProvider,
  InlineCompletionList,
  Position,
  ProviderResult,
  Range,
  TextDocument,
  env,
  workspace,
} from "vscode";
import { ideProtocolClient } from "../activation/activate";
import { TabAutocompleteModel } from "../loadConfig";

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
  document: TextDocument,
  pos: Position,
  token: CancellationToken
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
    const fullPrefix = document.getText(new Range(new Position(0, 0), pos));
    const fullSuffix = document.getText(
      new Range(pos, new Position(document.lineCount, Number.MAX_SAFE_INTEGER))
    );
    const clipboardText = await env.clipboard.readText();
    const { prefix, suffix } = await constructAutocompletePrompt(
      document.fileName,
      fullPrefix,
      fullSuffix,
      clipboardText,
      lang
    );

    const { template, completionOptions } = getTemplateForModel(llm.model);

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
      // LLM
      for await (const update of llm.streamComplete(prompt, {
        ...completionOptions,
        maxTokens: 100,
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
  } catch (e) {
    console.warn("Error generating autocompletion: ", e);
    return undefined;
  }
}

export class ContinueCompletionProvider
  implements InlineCompletionItemProvider
{
  private static debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private static debouncing: boolean = false;
  private static lastUUID: string | undefined = undefined;

  public async provideInlineCompletionItems(
    document: TextDocument,
    position: Position,
    context: InlineCompletionContext,
    token: CancellationToken
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    // Debounce
    const uuid = uuidv4();
    ContinueCompletionProvider.lastUUID = uuid;

    if (ContinueCompletionProvider.debouncing) {
      ContinueCompletionProvider.debounceTimeout?.refresh();
      const lastUUID = await new Promise((resolve) =>
        setTimeout(() => {
          resolve(ContinueCompletionProvider.lastUUID);
        }, DEBOUNCE_DELAY)
      );
      if (uuid !== lastUUID) {
        return [];
      }
    } else {
      ContinueCompletionProvider.debouncing = true;
      ContinueCompletionProvider.debounceTimeout = setTimeout(async () => {
        ContinueCompletionProvider.debouncing = false;
      }, DEBOUNCE_DELAY);
    }

    const enableTabAutocomplete =
      workspace
        .getConfiguration("continue")
        .get<boolean>("enableTabAutocomplete") || false;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return [];
    }

    try {
      const outcome = await getTabCompletion(document, position, token);
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
        new InlineCompletionItem(
          completion,
          new Range(position, position.translate(0, completion.length)),
          {
            title: "Log Autocomplete Outcome",
            command: "continue.logAutocompleteOutcome",
            arguments: [outcome, logRejectionTimeout],
          }
        ),
      ];
    } catch (e: any) {
      console.log("Error getting autocompletion: ", e.message);
    }
  }
}
