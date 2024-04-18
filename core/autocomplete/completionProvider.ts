import Handlebars from "handlebars";
import { v4 as uuidv4 } from "uuid";
import { IDE, ILLM, Position, TabAutocompleteOptions } from "..";
import { RangeInFileWithContents } from "../commands/util";
import { ConfigHandler } from "../config/handler";
import { streamLines } from "../diff/util";
import OpenAI from "../llm/llms/OpenAI";
import { getBasename } from "../util";
import { logDevData } from "../util/devdata";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters";
import { Telemetry } from "../util/posthog";
import { getRangeInString } from "../util/ranges";
import AutocompleteLruCache from "./cache";
import { noFirstCharNewline, onlyWhitespaceAfterEndOfLine } from "./charStream";
import {
  constructAutocompletePrompt,
  languageForFilepath,
} from "./constructPrompt";
import { AutocompleteLanguageInfo } from "./languages";
import {
  avoidPathLine,
  noTopLevelKeywordsMidline,
  stopAtLines,
  stopAtRepeatingLines,
  stopAtSimilarLine,
  streamWithNewLines,
} from "./lineStream";
import { AutocompleteSnippet } from "./ranking";
import { getTemplateForModel } from "./templates";
import { GeneratorReuseManager } from "./util";

export interface AutocompleteInput {
  completionId: string;
  filepath: string;
  pos: Position;
  recentlyEditedFiles: RangeInFileWithContents[];
  recentlyEditedRanges: RangeInFileWithContents[];
  clipboardText: string;
}

export interface AutocompleteOutcome extends TabAutocompleteOptions {
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

const DOUBLE_NEWLINE = "\n\n";
const WINDOWS_DOUBLE_NEWLINE = "\r\n\r\n";
const SRC_DIRECTORY = "/src/";
// Starcoder2 tends to output artifacts starting with the letter "t"
const STARCODER2_T_ARTIFACTS = ["t.", "\nt"];
const PYTHON_ENCODING = "#- coding: utf-8";
const CODE_BLOCK_END = "```";

const multilineStops = [DOUBLE_NEWLINE, WINDOWS_DOUBLE_NEWLINE];
const commonStops = [SRC_DIRECTORY, PYTHON_ENCODING, CODE_BLOCK_END];

function formatExternalSnippet(
  filepath: string,
  snippet: string,
  language: AutocompleteLanguageInfo,
) {
  const comment = language.comment;
  const lines = [
    comment + " Path: " + getBasename(filepath),
    ...snippet
      .trim()
      .split("\n")
      .map((line) => comment + " " + line),
    comment,
  ];
  return lines.join("\n");
}

export async function getTabCompletion(
  token: AbortSignal,
  options: TabAutocompleteOptions,
  llm: ILLM,
  ide: IDE,
  generatorReuseManager: GeneratorReuseManager,
  input: AutocompleteInput,
  getDefinitionsFromLsp: (
    filepath: string,
    contents: string,
    cursorIndex: number,
    ide: IDE,
  ) => Promise<AutocompleteSnippet[]>,
): Promise<AutocompleteOutcome | undefined> {
  const startTime = Date.now();

  const {
    filepath,
    pos,
    recentlyEditedFiles,
    recentlyEditedRanges,
    clipboardText,
  } = input;
  const fileContents = await ide.readFile(filepath);
  const fileLines = fileContents.split("\n");

  // Filter
  const lang = languageForFilepath(filepath);
  const line = fileLines[pos.line] ?? "";
  for (const endOfLine of lang.endOfLine) {
    if (line.endsWith(endOfLine) && pos.character >= line.length) {
      return undefined;
    }
  }

  // Model
  if (llm instanceof OpenAI) {
    llm.useLegacyCompletionsEndpoint = true;
  } else if (
    llm.providerName === "free-trial" &&
    llm.model !== "starcoder-7b"
  ) {
    throw new Error(
      "The only free trial model supported for tab-autocomplete is starcoder-7b.",
    );
  }
  if (!llm) return;

  // Prompt
  const fullPrefix = getRangeInString(fileContents, {
    start: { line: 0, character: 0 },
    end: pos,
  });
  const fullSuffix = getRangeInString(fileContents, {
    start: pos,
    end: { line: fileLines.length - 1, character: Number.MAX_SAFE_INTEGER },
  });
  const lineBelowCursor =
    fileLines[Math.min(pos.line + 1, fileLines.length - 1)];

  let extrasSnippets = (await Promise.race([
    getDefinitionsFromLsp(
      filepath,
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

  let { prefix, suffix, completeMultiline, snippets } =
    await constructAutocompletePrompt(
      filepath,
      pos.line,
      fullPrefix,
      fullSuffix,
      clipboardText,
      lang,
      options,
      recentlyEditedRanges,
      recentlyEditedFiles,
      llm.model,
      extrasSnippets,
    );

  // Template prompt
  const { template, completionOptions } = options.template
    ? { template: options.template, completionOptions: {} }
    : getTemplateForModel(llm.model);

  let prompt: string;
  const filename = getBasename(filepath);
  const reponame = getBasename(workspaceDirs[0] ?? "myproject");
  if (typeof template === "string") {
    const compiledTemplate = Handlebars.compile(template);

    // Format snippets as comments and prepend to prefix
    const formattedSnippets = snippets
      .map((snippet) =>
        formatExternalSnippet(snippet.filepath, snippet.contents, lang),
      )
      .join("\n");
    if (formattedSnippets.length > 0) {
      prefix = formattedSnippets + "\n\n" + prefix;
    }

    prompt = compiledTemplate({
      prefix,
      suffix,
      filename,
      reponame,
    });
  } else {
    // Let the template function format snippets
    prompt = template(prefix, suffix, filename, reponame, snippets);
  }

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
    let stop = [
      ...(completionOptions?.stop || []),
      ...multilineStops,
      ...commonStops,
      ...(llm.model.toLowerCase().includes("starcoder2")
        ? STARCODER2_T_ARTIFACTS
        : []),
      ...lang.stopWords,
    ];

    const multiline =
      options.multilineCompletions !== "never" &&
      (options.multilineCompletions === "always" || completeMultiline);

    // Try to reuse pending requests if what the user typed matches start of completion
    let generator = generatorReuseManager.getGenerator(
      prefix,
      () =>
        llm.streamComplete(prompt, {
          ...completionOptions,
          raw: true,
          stop,
        }),
      multiline,
    );

    // LLM
    let cancelled = false;
    const generatorWithCancellation = async function* () {
      for await (const update of generator) {
        if (token.aborted) {
          cancelled = true;
          return;
        }
        yield update;
      }
    };
    let charGenerator = generatorWithCancellation();
    charGenerator = noFirstCharNewline(charGenerator);
    charGenerator = onlyWhitespaceAfterEndOfLine(charGenerator, lang.endOfLine);

    let lineGenerator = streamLines(charGenerator);
    lineGenerator = stopAtLines(lineGenerator);
    lineGenerator = stopAtRepeatingLines(lineGenerator);
    lineGenerator = avoidPathLine(lineGenerator, lang.comment);
    lineGenerator = noTopLevelKeywordsMidline(lineGenerator, lang.stopWords);
    lineGenerator = streamWithNewLines(lineGenerator);

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
    ...options,
  };
}

export class CompletionProvider {
  private static debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private static debouncing: boolean = false;
  private static lastUUID: string | undefined = undefined;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly getLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: (
      filepath: string,
      contents: string,
      cursorIndex: number,
      ide: IDE,
    ) => Promise<AutocompleteSnippet[]>,
  ) {
    this.generatorReuseManager = new GeneratorReuseManager(
      this.onError.bind(this),
    );
  }

  private generatorReuseManager: GeneratorReuseManager;
  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();

  private onError(e: any) {
    console.warn("Error generating autocompletion: ", e);
    if (!this.errorsShown.has(e.message)) {
      this.errorsShown.add(e.message);
      this._onError(e);
    }
  }

  public cancel() {
    this._abortControllers.forEach((abortController, id) => {
      abortController.abort();
    });
    this._abortControllers.clear();
  }

  private _abortControllers = new Map<string, AbortController>();
  private _logRejectionTimeouts = new Map<string, NodeJS.Timeout>();
  private _outcomes = new Map<string, AutocompleteOutcome>();

  public accept(completionId: string) {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId));
      this._logRejectionTimeouts.delete(completionId);
    }

    if (this._outcomes.has(completionId)) {
      const outcome = this._outcomes.get(completionId)!;
      outcome.accepted = true;
      logDevData("autocomplete", outcome);
      Telemetry.capture("autocomplete", {
        accepted: outcome.accepted,
        modelName: outcome.modelName,
        modelProvider: outcome.modelProvider,
        time: outcome.time,
        cacheHit: outcome.cacheHit,
      });
      this._outcomes.delete(completionId);
    }
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
  ): Promise<AutocompleteOutcome | undefined> {
    // Create abort signal if not given
    if (!token) {
      const controller = new AbortController();
      token = controller.signal;
      this._abortControllers.set(input.completionId, controller);
    }

    try {
      // Debounce
      const uuid = uuidv4();
      CompletionProvider.lastUUID = uuid;

      const config = await this.configHandler.loadConfig();
      const options = {
        ...DEFAULT_AUTOCOMPLETE_OPTS,
        ...config.tabAutocompleteOptions,
      };

      // Allow disabling autocomplete from config.json
      if (options.disable) {
        return undefined;
      }

      if (CompletionProvider.debouncing) {
        CompletionProvider.debounceTimeout?.refresh();
        const lastUUID = await new Promise((resolve) =>
          setTimeout(() => {
            resolve(CompletionProvider.lastUUID);
          }, options.debounceDelay),
        );
        if (uuid !== lastUUID) {
          return undefined;
        }
      } else {
        CompletionProvider.debouncing = true;
        CompletionProvider.debounceTimeout = setTimeout(async () => {
          CompletionProvider.debouncing = false;
        }, options.debounceDelay);
      }

      // Get completion
      const llm = await this.getLlm();
      if (!llm) {
        return undefined;
      }

      // Set temperature (but don't overrride)
      if (llm.completionOptions.temperature === undefined) {
        llm.completionOptions.temperature = 0.01;
      }

      const outcome = await getTabCompletion(
        token,
        options,
        llm,
        this.ide,
        this.generatorReuseManager,
        input,
        this.getDefinitionsFromLsp,
      );
      const completion = outcome?.completion;

      if (!completion) {
        return undefined;
      }

      // Do some stuff later so as not to block return. Latency matters
      setTimeout(async () => {
        if (!outcome.cacheHit) {
          (await this.autocompleteCache).put(outcome.prompt, completion);
        }
      }, 100);

      outcome.accepted = false;
      const logRejectionTimeout = setTimeout(() => {
        // Wait 10 seconds, then assume it wasn't accepted
        logDevData("autocomplete", outcome);
        const { prompt, completion, ...restOfOutcome } = outcome;
        Telemetry.capture("autocomplete", {
          ...restOfOutcome,
        });
        this._logRejectionTimeouts.delete(input.completionId);
      }, 10_000);
      this._outcomes.set(input.completionId, outcome);
      this._logRejectionTimeouts.set(input.completionId, logRejectionTimeout);

      return outcome;
    } catch (e: any) {
      this.onError(e);
    } finally {
      this._abortControllers.delete(input.completionId);
    }
  }
}
