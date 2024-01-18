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

async function getTabCompletion(
  document: TextDocument,
  pos: Position
): Promise<string | undefined> {
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
    }

    // Don't return empty
    if (completion.trim().length <= 0) {
      return undefined;
    }

    // Post-processing
    completion = completion.trimEnd();

    // Log dev data
    const time = Date.now() - startTime;
    setTimeout(() => {
      ideProtocolClient.logDevData("autocomplete", {
        time,
        completion,
        prompt,
        modelProvider: llm.providerName,
        modelName: llm.model,
        completionOptions,
      });
    }, 100);

    return completion;
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

    // Only complete in empty lines
    // const line = document.lineAt(position.line);
    // if (!line.isEmptyOrWhitespace) {
    //   return [];
    // }

    try {
      const completion = await getTabCompletion(document, position);
      if (!completion) {
        return [];
      }

      return [
        new InlineCompletionItem(
          completion,
          new Range(position, position.translate(0, completion.length))
        ),
      ];
    } catch (e: any) {
      console.log("Error getting autocompletion: ", e.message);
    }
  }
}
