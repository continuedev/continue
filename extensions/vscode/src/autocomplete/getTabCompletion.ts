import { TabAutocompleteOptions } from "core";
import { AutocompleteLruCache } from "core/autocomplete/cache";
import { onlyWhitespaceAfterEndOfLine } from "core/autocomplete/charStream";
import {
  AutocompleteSnippet,
  constructAutocompletePrompt,
  languageForFilepath,
} from "core/autocomplete/constructPrompt";
import {
  stopAtSimilarLine,
  streamWithNewLines,
} from "core/autocomplete/lineStream";
import { getTemplateForModel } from "core/autocomplete/templates";
import { GeneratorReuseManager } from "core/autocomplete/util";
import { streamLines } from "core/diff/util";
import OpenAI from "core/llm/llms/OpenAI";
import Handlebars from "handlebars";
import * as vscode from "vscode";
import { ideProtocolClient } from "../activation/activate";
import { TabAutocompleteModel } from "../loadConfig";
import { ContinueCompletionProvider } from "./completionProvider";
import { setupStatusBar, stopStatusBarLoading } from "./statusBar";

async function getDefinition(
  uri: string,
  line: number,
  character: number
): Promise<AutocompleteSnippet | undefined> {
  const definitions = (await vscode.commands.executeCommand(
    "vscode.executeDefinitionProvider",
    vscode.Uri.parse(uri),
    new vscode.Position(line, character)
  )) as any;

  if (definitions[0]?.targetRange) {
    return {
      filepath: uri,
      content: await ideProtocolClient.readRangeInFile(
        definitions[0].targetUri.fsPath,
        definitions[0].targetRange
      ),
    };
  }

  return undefined;
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

export async function getTabCompletion(
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
    const llm = await TabAutocompleteModel.get();
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
    const { prefix, suffix, completeMultiline } =
      await constructAutocompletePrompt(
        document.uri.toString(),
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
      if (
        options.multilineCompletions !== "always" &&
        (options.multilineCompletions === "never" || !completeMultiline)
      ) {
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
      const finalGenerator = stopAtSimilarLine(lineGenerator, lineBelowCursor);
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
