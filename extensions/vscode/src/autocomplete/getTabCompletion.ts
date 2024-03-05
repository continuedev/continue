import { IDE, TabAutocompleteOptions } from "core";
import { AutocompleteLruCache } from "core/autocomplete/cache";
import { onlyWhitespaceAfterEndOfLine } from "core/autocomplete/charStream";
import {
  constructAutocompletePrompt,
  languageForFilepath,
} from "core/autocomplete/constructPrompt";
import {
  avoidPathLine,
  stopAtLines,
  stopAtRepeatingLines,
  stopAtSimilarLine,
  streamWithNewLines,
} from "core/autocomplete/lineStream";
import { AutocompleteSnippet } from "core/autocomplete/ranking";
import { getTemplateForModel } from "core/autocomplete/templates";
import { GeneratorReuseManager } from "core/autocomplete/util";
import { streamLines } from "core/diff/util";
import OpenAI from "core/llm/llms/OpenAI";
import Handlebars from "handlebars";
import * as vscode from "vscode";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { getDefinitionsFromLsp } from "./lsp";
import { RecentlyEditedTracker } from "./recentlyEdited";
import { setupStatusBar, stopStatusBarLoading } from "./statusBar";

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
const recentlyEditedTracker = new RecentlyEditedTracker();

export async function getTabCompletion(
  document: vscode.TextDocument,
  pos: vscode.Position,
  token: vscode.CancellationToken,
  options: TabAutocompleteOptions,
  tabAutocompleteModel: TabAutocompleteModel,
  ide: IDE,
  generatorReuseManager: GeneratorReuseManager,
): Promise<AutocompleteOutcome | undefined> {
  const startTime = Date.now();

  // Filter
  const lang = languageForFilepath(document.fileName);
  const line = document.lineAt(pos).text;
  for (const endOfLine of lang.endOfLine) {
    if (line.endsWith(endOfLine) && pos.character >= line.length) {
      return undefined;
    }
  }

  // Model
  const llm = await tabAutocompleteModel.get();
  if (llm instanceof OpenAI) {
    llm.useLegacyCompletionsEndpoint = true;
  }
  if (!llm) return;

  // Prompt
  const fullPrefix = document.getText(
    new vscode.Range(new vscode.Position(0, 0), pos),
  );
  const fullSuffix = document.getText(
    new vscode.Range(
      pos,
      new vscode.Position(document.lineCount, Number.MAX_SAFE_INTEGER),
    ),
  );
  const lineBelowCursor = document.lineAt(
    Math.min(pos.line + 1, document.lineCount - 1),
  ).text;
  const clipboardText = await vscode.env.clipboard.readText();

  let extrasSnippets = (await Promise.race([
    getDefinitionsFromLsp(
      document.uri.fsPath,
      fullPrefix + fullSuffix,
      fullPrefix.length,
      ide,
    ),
    new Promise((resolve) => {
      setTimeout(() => resolve([]), 100);
    }),
  ])) as AutocompleteSnippet[];

  const workspaceDirs = await ide.getWorkspaceDirs();
  if (options.onlyMyCode) {
    extrasSnippets = extrasSnippets.filter((snippet) => {
      return workspaceDirs.some((dir) => snippet.filepath.startsWith(dir));
    });
  }

  const { prefix, suffix, completeMultiline } =
    await constructAutocompletePrompt(
      document.uri.toString(),
      pos.line,
      fullPrefix,
      fullSuffix,
      clipboardText,
      lang,
      options,
      await recentlyEditedTracker.getRecentlyEditedRanges(),
      await recentlyEditedTracker.getRecentlyEditedDocuments(),
      llm.model,
      extrasSnippets,
    );

  const { template, completionOptions } = options.template
    ? { template: options.template, completionOptions: {} }
    : getTemplateForModel(llm.model);

  const compiledTemplate = Handlebars.compile(template);
  const prompt = compiledTemplate({ prefix, suffix });

  // Completion
  let completion = "";

  const cache = await autocompleteCache;
  const cachedCompletion = options.useCache
    ? await cache.get(prompt)
    : undefined;
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

    const multiline =
      options.multilineCompletions !== "never" &&
      (options.multilineCompletions === "always" || completeMultiline);

    let generator = generatorReuseManager.getGenerator(
      prefix,
      () =>
        llm.streamComplete(prompt, {
          ...completionOptions,
          temperature: 0,
          raw: true,
          stop,
        }),
      multiline,
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
      lang.endOfLine,
    );
    const lineGenerator = streamWithNewLines(
      avoidPathLine(
        stopAtRepeatingLines(stopAtLines(streamLines(gen2))),
        lang.comment,
      ),
    );
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
}
