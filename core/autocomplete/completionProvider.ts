import Handlebars from "handlebars";
import ignore from "ignore";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { RangeInFileWithContents } from "../commands/util.js";
import { ConfigHandler } from "../config/handler.js";
import { TRIAL_FIM_MODEL } from "../config/onboarding.js";
import { streamLines } from "../diff/util.js";
import {
  IDE,
  ILLM,
  ModelProvider,
  Position,
  Range,
  TabAutocompleteOptions,
} from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { logDevData } from "../util/devdata.js";
import { getBasename } from "../util/index.js";
import {
  COUNT_COMPLETION_REJECTED_AFTER,
  DEFAULT_AUTOCOMPLETE_OPTS,
} from "../util/parameters.js";
import { Telemetry } from "../util/posthog.js";
import { getRangeInString } from "../util/ranges.js";
import { BracketMatchingService } from "./brackets.js";
import AutocompleteLruCache from "./cache.js";
import {
  noFirstCharNewline,
  onlyWhitespaceAfterEndOfLine,
} from "./charStream.js";
import {
  constructAutocompletePrompt,
  languageForFilepath,
} from "./constructPrompt.js";
import { isOnlyPunctuationAndWhitespace } from "./filter.js";
import { AutocompleteLanguageInfo } from "./languages.js";
import {
  avoidPathLine,
  noTopLevelKeywordsMidline,
  stopAtLines,
  stopAtRepeatingLines,
  stopAtSimilarLine,
  streamWithNewLines,
} from "./lineStream.js";
import { AutocompleteSnippet } from "./ranking.js";
import { RecentlyEditedRange } from "./recentlyEdited.js";
import { getTemplateForModel } from "./templates.js";
import { GeneratorReuseManager } from "./util.js";

export interface AutocompleteInput {
  completionId: string;
  filepath: string;
  pos: Position;
  recentlyEditedFiles: RangeInFileWithContents[];
  recentlyEditedRanges: RecentlyEditedRange[];
  clipboardText: string;
  // Used for notebook files
  manuallyPassFileContents?: string;
  // Used for VS Code git commit input box
  manuallyPassPrefix?: string;
  selectedCompletionInfo?: {
    text: string;
    range: Range;
  };
  injectDetails?: string;
}

export interface AutocompleteOutcome extends TabAutocompleteOptions {
  accepted?: boolean;
  time: number;
  prefix: string;
  suffix: string;
  prompt: string;
  completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
  cacheHit: boolean;
  filepath: string;
  gitRepo?: string;
  completionId: string;
  uniqueId: string;
}

const autocompleteCache = AutocompleteLruCache.get();

const DOUBLE_NEWLINE = "\n\n";
const WINDOWS_DOUBLE_NEWLINE = "\r\n\r\n";
const SRC_DIRECTORY = "/src/";
// Starcoder2 tends to output artifacts starting with the letter "t"
const STARCODER2_T_ARTIFACTS = ["t.", "\nt", "<file_sep>"];
const PYTHON_ENCODING = "#- coding: utf-8";
const CODE_BLOCK_END = "```";

const multilineStops: string[] = [DOUBLE_NEWLINE, WINDOWS_DOUBLE_NEWLINE];
const commonStops = [SRC_DIRECTORY, PYTHON_ENCODING, CODE_BLOCK_END];

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
];

function formatExternalSnippet(
  filepath: string,
  snippet: string,
  language: AutocompleteLanguageInfo,
) {
  const comment = language.comment;
  const lines = [
    `${comment} Path: ${getBasename(filepath)}`,
    ...snippet
      .trim()
      .split("\n")
      .map((line) => `${comment} ${line}`),
    comment,
  ];
  return lines.join("\n");
}

let shownGptClaudeWarning = false;
const nonAutocompleteModels = [
  // "gpt",
  // "claude",
  "mistral",
  "instruct",
];

export type GetLspDefinitionsFunction = (
  filepath: string,
  contents: string,
  cursorIndex: number,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
) => Promise<AutocompleteSnippet[]>;

export async function getTabCompletion(
  token: AbortSignal,
  options: TabAutocompleteOptions,
  llm: ILLM,
  ide: IDE,
  generatorReuseManager: GeneratorReuseManager,
  input: AutocompleteInput,
  getDefinitionsFromLsp: GetLspDefinitionsFunction,
  bracketMatchingService: BracketMatchingService,
): Promise<AutocompleteOutcome | undefined> {
  const startTime = Date.now();

  const {
    filepath,
    pos,
    recentlyEditedFiles,
    recentlyEditedRanges,
    clipboardText,
    manuallyPassFileContents,
    manuallyPassPrefix,
  } = input;
  const fileContents =
    manuallyPassFileContents ?? (await ide.readFile(filepath));
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
  if (!llm) {
    return;
  }
  if (llm instanceof OpenAI) {
    llm.useLegacyCompletionsEndpoint = true;
  } else if (
    llm.providerName === "free-trial" &&
    llm.model !== TRIAL_FIM_MODEL
  ) {
    llm.model = TRIAL_FIM_MODEL;
  }

  if (
    !shownGptClaudeWarning &&
    nonAutocompleteModels.some((model) => llm.model.includes(model)) &&
    !llm.model.includes("deepseek")
  ) {
    shownGptClaudeWarning = true;
    throw new Error(
      `Warning: ${llm.model} is not trained for tab-autocomplete, and will result in low-quality suggestions. See the docs to learn more about why: https://docs.continue.dev/walkthroughs/tab-autocomplete#i-want-better-completions-should-i-use-gpt-4`,
    );
  }

  // Prompt
  let fullPrefix =
    getRangeInString(fileContents, {
      start: { line: 0, character: 0 },
      end: input.selectedCompletionInfo?.range.start ?? pos,
    }) + (input.selectedCompletionInfo?.text ?? "");

  if (input.injectDetails) {
    const lines = fullPrefix.split("\n");
    fullPrefix = `${lines.slice(0, -1).join("\n")}\n${
      lang.comment
    } ${input.injectDetails.split("\n").join(`\n${lang.comment} `)}\n${
      lines[lines.length - 1]
    }`;
  }

  const fullSuffix = getRangeInString(fileContents, {
    start: pos,
    end: { line: fileLines.length - 1, character: Number.MAX_SAFE_INTEGER },
  });

  // First non-whitespace line below the cursor
  let lineBelowCursor = "";
  let i = 1;
  while (
    lineBelowCursor.trim() === "" &&
    pos.line + i <= fileLines.length - 1
  ) {
    lineBelowCursor = fileLines[Math.min(pos.line + i, fileLines.length - 1)];
    i++;
  }

  let extrasSnippets = options.useOtherFiles
    ? ((await Promise.race([
        getDefinitionsFromLsp(
          filepath,
          fullPrefix + fullSuffix,
          fullPrefix.length,
          ide,
          lang,
        ),
        new Promise((resolve) => {
          setTimeout(() => resolve([]), 100);
        }),
      ])) as AutocompleteSnippet[])
    : [];

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

  // If prefix is manually passed
  if (manuallyPassPrefix) {
    prefix = manuallyPassPrefix;
    suffix = "";
  }

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
      prefix = `${formattedSnippets}\n\n${prefix}`;
    }

    prompt = compiledTemplate({
      prefix,
      suffix,
      filename,
      reponame,
    });
  } else {
    // Let the template function format snippets
    prompt = template(prefix, suffix, filepath, reponame, snippets);
  }

  // Completion
  let completion = "";

  const cache = await autocompleteCache;
  const cachedCompletion = options.useCache
    ? await cache.get(prefix)
    : undefined;
  let cacheHit = false;
  if (cachedCompletion) {
    // Cache
    cacheHit = true;
    completion = cachedCompletion;
  } else {
    const stop = [
      ...(completionOptions?.stop || []),
      ...multilineStops,
      ...commonStops,
      ...(llm.model.toLowerCase().includes("starcoder2")
        ? STARCODER2_T_ARTIFACTS
        : []),
      ...lang.stopWords.map((word) => `\n${word}`),
    ];

    const multiline =
      !input.selectedCompletionInfo && // Only ever single-line if using intellisense selected value
      options.multilineCompletions !== "never" &&
      (options.multilineCompletions === "always" || completeMultiline);

    // Try to reuse pending requests if what the user typed matches start of completion
    const generator = generatorReuseManager.getGenerator(
      prefix,
      () =>
        llm.supportsFim()
          ? llm.streamFim(prefix, suffix, {
              ...completionOptions,
              stop,
            })
          : llm.streamComplete(prompt, {
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
    charGenerator = bracketMatchingService.stopOnUnmatchedClosingBracket(
      charGenerator,
      suffix,
      filepath,
    );

    let lineGenerator = streamLines(charGenerator);
    lineGenerator = stopAtLines(lineGenerator);
    lineGenerator = stopAtRepeatingLines(lineGenerator);
    lineGenerator = avoidPathLine(lineGenerator, lang.comment);
    lineGenerator = noTopLevelKeywordsMidline(lineGenerator, lang.stopWords);
    lineGenerator = streamWithNewLines(lineGenerator);

    const finalGenerator = stopAtSimilarLine(lineGenerator, lineBelowCursor);

    try {
      for await (const update of finalGenerator) {
        completion += update;
      }
    } catch (e: any) {
      if (ERRORS_TO_IGNORE.some((err) => e.includes(err))) {
        return undefined;
      }
      throw e;
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
    if (llm.model.includes("codestral")) {
      // Codestral sometimes starts with an extra space
      if (completion[0] === " " && completion[1] !== " ") {
        if (prefix.endsWith(" ") && suffix.startsWith("\n")) {
          completion = completion.slice(1);
        }
      }
    }
  }

  const time = Date.now() - startTime;
  return {
    time,
    completion,
    prefix,
    suffix,
    prompt,
    modelProvider: llm.providerName,
    modelName: llm.model,
    completionOptions,
    cacheHit,
    filepath: input.filepath,
    completionId: input.completionId,
    gitRepo: await ide.getRepoName(input.filepath),
    uniqueId: await ide.getUniqueId(),
    ...options,
  };
}

export class CompletionProvider {
  private static debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private static debouncing = false;
  private static lastUUID: string | undefined = undefined;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly getLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: GetLspDefinitionsFunction,
  ) {
    this.generatorReuseManager = new GeneratorReuseManager(
      this.onError.bind(this),
    );
  }

  private generatorReuseManager: GeneratorReuseManager;
  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();

  private onError(e: any) {
    console.warn("Error generating autocompletion: ", e);
    if (
      ERRORS_TO_IGNORE.some((err) =>
        typeof e === "string" ? e.includes(err) : e?.message?.includes(err),
      )
    ) {
      return;
    }
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

  // Key is completionId
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

      this.bracketMatchingService.handleAcceptedCompletion(
        outcome.completion,
        outcome.filepath,
      );
    }
  }

  public cancelRejectionTimeout(completionId: string) {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId)!);
      this._logRejectionTimeouts.delete(completionId);
    }

    if (this._outcomes.has(completionId)) {
      this._outcomes.delete(completionId);
    }
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
  ): Promise<AutocompleteOutcome | undefined> {
    try {
      // Debounce
      const uuid = uuidv4();
      CompletionProvider.lastUUID = uuid;

      const config = await this.configHandler.loadConfig();
      const options = {
        ...DEFAULT_AUTOCOMPLETE_OPTS,
        ...config.tabAutocompleteOptions,
      };

      // Check whether autocomplete is disabled for this file
      if (options.disableInFiles) {
        // Relative path needed for `ignore`
        const workspaceDirs = await this.ide.getWorkspaceDirs();
        let filepath = input.filepath;
        for (const workspaceDir of workspaceDirs) {
          if (filepath.startsWith(workspaceDir)) {
            filepath = path.relative(workspaceDir, filepath);
            break;
          }
        }

        // Worst case we can check filetype glob patterns
        if (filepath === input.filepath) {
          filepath = getBasename(filepath);
        }

        const pattern = ignore().add(options.disableInFiles);
        if (pattern.ignores(filepath)) {
          return undefined;
        }
      }

      // Create abort signal if not given
      if (!token) {
        const controller = new AbortController();
        token = controller.signal;
        this._abortControllers.set(input.completionId, controller);
      }

      // Allow disabling autocomplete from config.json
      if (options.disable) {
        return undefined;
      }

      // Debounce
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

      // Set model-specific options
      const LOCAL_PROVIDERS: ModelProvider[] = [
        "ollama",
        "lmstudio",
        "llama.cpp",
        "llamafile",
        "text-gen-webui",
      ];
      if (LOCAL_PROVIDERS.includes(llm.providerName)) {
        options.maxPromptTokens = 500;
      }

      const outcome = await getTabCompletion(
        token,
        options,
        llm,
        this.ide,
        this.generatorReuseManager,
        input,
        this.getDefinitionsFromLsp,
        this.bracketMatchingService,
      );

      if (!outcome?.completion) {
        return undefined;
      }

      // Filter out unwanted results
      if (isOnlyPunctuationAndWhitespace(outcome.completion)) {
        return undefined;
      }

      // Do some stuff later so as not to block return. Latency matters
      const completionToCache = outcome.completion;
      setTimeout(async () => {
        if (!outcome.cacheHit) {
          (await this.autocompleteCache).put(outcome.prefix, completionToCache);
        }
      }, 100);

      return outcome;
    } catch (e: any) {
      this.onError(e);
    } finally {
      this._abortControllers.delete(input.completionId);
    }
  }

  _lastDisplayedCompletion: { id: string; displayedAt: number } | undefined =
    undefined;

  markDisplayed(completionId: string, outcome: AutocompleteOutcome) {
    const logRejectionTimeout = setTimeout(() => {
      // Wait 10 seconds, then assume it wasn't accepted
      outcome.accepted = false;
      logDevData("autocomplete", outcome);
      const { prompt, completion, ...restOfOutcome } = outcome;
      Telemetry.capture("autocomplete", {
        ...restOfOutcome,
      });
      this._logRejectionTimeouts.delete(completionId);
    }, COUNT_COMPLETION_REJECTED_AFTER);
    this._outcomes.set(completionId, outcome);
    this._logRejectionTimeouts.set(completionId, logRejectionTimeout);

    // If the previously displayed completion is still waiting for rejection,
    // and this one is a continuation of that (the outcome.completion is the same modulo prefix)
    // then we should cancel the rejection timeout
    const previous = this._lastDisplayedCompletion;
    const now = Date.now();
    if (previous && this._logRejectionTimeouts.has(previous.id)) {
      const previousOutcome = this._outcomes.get(previous.id);
      const c1 = previousOutcome?.completion.split("\n")[0] ?? "";
      const c2 = outcome.completion.split("\n")[0];
      if (
        previousOutcome &&
        (c1.endsWith(c2) ||
          c2.endsWith(c1) ||
          c1.startsWith(c2) ||
          c2.startsWith(c1))
      ) {
        this.cancelRejectionTimeout(previous.id);
      } else if (now - previous.displayedAt < 500) {
        // If a completion isn't shown for more than
        this.cancelRejectionTimeout(previous.id);
      }
    }

    this._lastDisplayedCompletion = {
      id: completionId,
      displayedAt: now,
    };
  }
}
