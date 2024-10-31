import { ConfigHandler } from "../config/ConfigHandler.js";
import { IDE, ILLM, TabAutocompleteOptions } from "../index.js";
import { logDevData } from "../util/devdata.js";
import {
  COUNT_COMPLETION_REJECTED_AFTER,
  DEFAULT_AUTOCOMPLETE_OPTS,
} from "../util/parameters.js";
import { Telemetry } from "../util/posthog.js";
import { getRangeInString } from "../util/ranges.js";

import { AutocompleteLanguageInfo } from "./constants/AutocompleteLanguageInfo.js";
import {
  constructAutocompletePrompt,
  languageForFilepath,
} from "./constructPrompt.js";
import { AutocompleteSnippet } from "./context/ranking/index.js";
import { RootPathContextService } from "./context/RootPathContextService.js";
import { GeneratorReuseManager } from "./generation/GeneratorReuseManager.js";
import { postprocessCompletion } from "./postprocessing/index.js";
// @prettier-ignore
import { TRIAL_FIM_MODEL } from "../config/onboarding.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { AutocompleteDebouncer } from "./AutocompleteDebouncer.js";
import AutocompleteLruCache from "./AutocompleteLruCache.js";
import { ImportDefinitionsService } from "./context/ImportDefinitionsService.js";
import { BracketMatchingService } from "./filtering/BracketMatchingService.js";
import { StreamTransformPipeline } from "./filtering/streamTransforms/StreamTransformPipeline.js";
import { shouldPrefilter } from "./prefiltering/index.js";
import { renderPrompt } from "./templating/index.js";
import { AutocompleteInput, AutocompleteOutcome } from "./types.js";

const autocompleteCache = AutocompleteLruCache.get();

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
];

export type GetLspDefinitionsFunction = (
  filepath: string,
  contents: string,
  cursorIndex: number,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
) => Promise<AutocompleteSnippet[]>;

export class CompletionProvider {
  private importDefinitionsService: ImportDefinitionsService;
  private rootPathContextService: RootPathContextService;
  private generatorReuseManager: GeneratorReuseManager;
  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();
  private debouncer = new AutocompleteDebouncer();
  private streamTransformPipeline = new StreamTransformPipeline();
  // private nearbyDefinitionsService = new NearbyDefinitionsService();

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly _injectedGetLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: GetLspDefinitionsFunction,
  ) {
    this.generatorReuseManager = new GeneratorReuseManager(
      this.onError.bind(this),
    );
    this.importDefinitionsService = new ImportDefinitionsService(this.ide);
    this.rootPathContextService = new RootPathContextService(
      this.importDefinitionsService,
      this.ide,
    );
  }

  private async _prepareLlm(): Promise<ILLM | undefined> {
    const llm = await this._injectedGetLlm();

    if (!llm) {
      return undefined;
    }

    // Ignore empty API keys for Mistral since we currently write
    // a template provider without one during onboarding
    if (llm.providerName === "mistral" && llm.apiKey === "") {
      return undefined;
    }

    // Set temperature (but don't override)
    if (llm.completionOptions.temperature === undefined) {
      llm.completionOptions.temperature = 0.01;
    }

    if (llm instanceof OpenAI) {
      llm.useLegacyCompletionsEndpoint = true;
    } else if (
      llm.providerName === "free-trial" &&
      llm.model !== TRIAL_FIM_MODEL
    ) {
      llm.model = TRIAL_FIM_MODEL;
    }

    return llm;
  }

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
      this.logAutocompleteOutcome(outcome);
      this._outcomes.delete(completionId);

      this.bracketMatchingService.handleAcceptedCompletion(
        outcome.completion,
        outcome.filepath,
      );
    }
  }

  private logAutocompleteOutcome(outcome: AutocompleteOutcome) {
    outcome.accepted = true;
    logDevData("autocomplete", outcome);
    const { prompt, completion, prefix, suffix, ...restOfOutcome } = outcome;
    void Telemetry.capture(
      "autocomplete",
      {
        accepted: restOfOutcome.accepted,
        cacheHit: restOfOutcome.cacheHit,
        completionId: restOfOutcome.completionId,
        completionOptions: restOfOutcome.completionOptions,
        debounceDelay: restOfOutcome.debounceDelay,
        fileExtension: restOfOutcome.filepath.split(".")?.slice(-1)[0],
        maxPromptTokens: restOfOutcome.maxPromptTokens,
        modelName: restOfOutcome.modelName,
        modelProvider: restOfOutcome.modelProvider,
        multilineCompletions: restOfOutcome.multilineCompletions,
        time: restOfOutcome.time,
        useRecentlyEdited: restOfOutcome.useRecentlyEdited,
        useRootPathContext: restOfOutcome.useRootPathContext,
      },
      true,
    );
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

  private async _getAutocompleteOptions() {
    const config = await this.configHandler.loadConfig();
    const options = {
      ...DEFAULT_AUTOCOMPLETE_OPTS,
      ...config.tabAutocompleteOptions,
    };
    return options;
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
  ): Promise<AutocompleteOutcome | undefined> {
    try {
      const options = await this._getAutocompleteOptions();

      if (await shouldPrefilter(input, options, this.ide)) {
        return undefined;
      }

      // Debounce
      if (await this.debouncer.delayAndShouldDebounce(options.debounceDelay)) {
        return undefined;
      }

      // Get completion
      const llm = await this._prepareLlm();
      if (!llm) {
        return undefined;
      }

      // Create abort signal if not given
      if (!token) {
        const controller = new AbortController();
        token = controller.signal;
        this._abortControllers.set(input.completionId, controller);
      }

      const outcome = await this.getTabCompletion(token, options, llm, input);

      if (!outcome?.completion) {
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
      this.logAutocompleteOutcome(outcome);
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

  async getTabCompletion(
    token: AbortSignal,
    options: TabAutocompleteOptions,
    llm: ILLM,
    input: AutocompleteInput,
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
      manuallyPassFileContents ?? (await this.ide.readFile(filepath));
    const fileLines = fileContents.split("\n");

    // Filter
    const lang = languageForFilepath(filepath);

    // Prompt
    let fullPrefix =
      getRangeInString(fileContents, {
        start: { line: 0, character: 0 },
        end: input.selectedCompletionInfo?.range.start ?? pos,
      }) + (input.selectedCompletionInfo?.text ?? "");

    if (input.injectDetails) {
      const lines = fullPrefix.split("\n");
      fullPrefix = `${lines.slice(0, -1).join("\n")}\n${
        lang.singleLineComment
      } ${input.injectDetails
        .split("\n")
        .join(`\n${lang.singleLineComment} `)}\n${lines[lines.length - 1]}`;
    }

    const fullSuffix = getRangeInString(fileContents, {
      start: pos,
      end: { line: fileLines.length - 1, character: Number.MAX_SAFE_INTEGER },
    });

    let extrasSnippets = options.useOtherFiles
      ? ((await Promise.race([
          this.getDefinitionsFromLsp(
            filepath,
            fullPrefix + fullSuffix,
            fullPrefix.length,
            this.ide,
            lang,
          ),
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 100);
          }),
        ])) as AutocompleteSnippet[])
      : [];

    const workspaceDirs = await this.ide.getWorkspaceDirs();
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
        this.importDefinitionsService,
        this.rootPathContextService,
      );

    // If prefix is manually passed
    if (manuallyPassPrefix) {
      prefix = manuallyPassPrefix;
      suffix = "";
    }

    const [prompt, completionOptions, multiline] = renderPrompt(
      options,
      prefix,
      suffix,
      filepath,
      lang,
      snippets,
      llm.model,
      workspaceDirs,
      options.template,
      input.selectedCompletionInfo,
      completeMultiline,
    );

    // Completion
    let completion: string | undefined = "";

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
      // Try to reuse pending requests if what the user typed matches start of completion
      const generator = this.generatorReuseManager.getGenerator(
        prefix,
        () =>
          llm.supportsFim()
            ? llm.streamFim(prefix, suffix, completionOptions)
            : llm.streamComplete(prompt, {
                ...completionOptions,
                raw: true,
              }),
        multiline,
      );

      // Full stop means to stop the LLM's generation, instead of just truncating the displayed completion
      const fullStop = () =>
        this.generatorReuseManager.currentGenerator?.cancel();

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

      const initialGenerator = generatorWithCancellation();
      const finalGenerator = options.transform
        ? this.streamTransformPipeline.transform(
            initialGenerator,
            prefix,
            suffix,
            filepath,
            multiline,
            pos,
            fileLines,
            completionOptions?.stop || [],
            lang,
            fullStop,
          )
        : initialGenerator;

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

      const processedCompletion = options.transform
        ? postprocessCompletion({
            completion,
            prefix,
            suffix,
            llm,
          })
        : completion;

      completion = processedCompletion;
    }

    const time = Date.now() - startTime;

    if (!completion) {
      return undefined;
    }

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
      gitRepo: await this.ide.getRepoName(input.filepath),
      uniqueId: await this.ide.getUniqueId(),
      ...options,
    };
  }
}
