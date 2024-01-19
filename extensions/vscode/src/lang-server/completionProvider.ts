import { AutocompleteLruCache } from "core/autocomplete/cache";
import { getTemplateForModel } from "core/autocomplete/templates";
import Handlebars from "handlebars";
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

  try {
    // Model
    const llm = await TabAutocompleteModel.get();
    if (!llm) return;

    // Prompt
    const prefix = document.getText(new Range(new Position(0, 0), pos));
    const suffix = document.getText(
      new Range(pos, new Position(document.lineCount, Number.MAX_SAFE_INTEGER))
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
        stop: [
          ...(completionOptions?.stop || []),
          "\n\n",
          "function",
          "class",
          "module",
          "export ",
          "```",
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
  public async provideInlineCompletionItems(
    document: TextDocument,
    position: Position,
    context: InlineCompletionContext,
    token: CancellationToken
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
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
