import { ConfigHandler } from "../config/ConfigHandler.js";
import { IDE, ILLM } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";

import { shouldCompleteMultiline } from "./classification/shouldCompleteMultiline.js";
import { ContextRetrievalService } from "./context/ContextRetrievalService.js";

import { isSecurityConcern } from "../indexing/ignore.js";
import { BracketMatchingService } from "./filtering/BracketMatchingService.js";
import { CompletionStreamer } from "./generation/CompletionStreamer.js";
import { postprocessCompletion } from "./postprocessing/index.js";
import { shouldPrefilter } from "./prefiltering/index.js";
import { getAllSnippetsWithoutRace } from "./snippets/index.js";
import { renderPromptWithTokenLimit } from "./templating/index.js";
import { GetLspDefinitionsFunction } from "./types.js";
import { AutocompleteDebouncer } from "./util/AutocompleteDebouncer.js";
import { AutocompleteLoggingService } from "./util/AutocompleteLoggingService.js";
import AutocompleteLruCache from "./util/AutocompleteLruCache.js";
import { HelperVars } from "./util/HelperVars.js";
import { AutocompleteInput, AutocompleteOutcome } from "./util/types.js";

const autocompleteCachePromise = AutocompleteLruCache.get();

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
  "operation was aborted",
];

export class CompletionProvider {
  private autocompleteCache?: AutocompleteLruCache;
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();
  private debouncer = new AutocompleteDebouncer();
  private completionStreamer: CompletionStreamer;
  private loggingService = new AutocompleteLoggingService();
  private contextRetrievalService: ContextRetrievalService;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly _injectedGetLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: GetLspDefinitionsFunction,
  ) {
    this.completionStreamer = new CompletionStreamer(this.onError.bind(this));
    this.contextRetrievalService = new ContextRetrievalService(this.ide);
    void this.initCache();
  }

  private async initCache() {
    try {
      this.autocompleteCache = await autocompleteCachePromise;
    } catch (e) {
      console.error("Failed to initialize autocomplete cache:", e);
    }
  }

  private async getCache(): Promise<AutocompleteLruCache> {
    if (!this.autocompleteCache) {
      this.autocompleteCache = await autocompleteCachePromise;
    }
    return this.autocompleteCache;
  }

  private async _prepareLlm(): Promise<ILLM | undefined> {
    const llm = await this._injectedGetLlm();

    if (!llm) {
      return undefined;
    }

    // Temporary fix for JetBrains autocomplete bug as described in https://github.com/continuedev/continue/pull/3022
    if (llm.model === undefined && llm.completionOptions?.model !== undefined) {
      llm.model = llm.completionOptions.model;
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
    }

    return llm;
  }

  private onError(e: any) {
    if (
      ERRORS_TO_IGNORE.some((err) =>
        typeof e === "string" ? e.includes(err) : e?.message?.includes(err),
      )
    ) {
      return;
    }

    console.warn("Error generating autocompletion: ", e);
    if (!this.errorsShown.has(e.message)) {
      this.errorsShown.add(e.message);
      this._onError(e);
    }
  }

  public cancel() {
    this.loggingService.cancel();
  }

  public accept(completionId: string) {
    const outcome = this.loggingService.accept(completionId);
    if (!outcome) {
      return;
    }
    this.bracketMatchingService.handleAcceptedCompletion(
      outcome.completion,
      outcome.filepath,
    );
  }

  public markDisplayed(completionId: string, outcome: AutocompleteOutcome) {
    this.loggingService.markDisplayed(completionId, outcome);
  }

  private async _getAutocompleteOptions(llm: ILLM) {
    const { config } = await this.configHandler.loadConfig();
    const options = {
      ...DEFAULT_AUTOCOMPLETE_OPTS,
      ...config?.tabAutocompleteOptions,
      ...llm.autocompleteOptions,
    };

    // Enable static contextualization if defined.
    if (config?.experimental?.enableStaticContextualization) {
      options.experimental_enableStaticContextualization = true;
    }

    return options;
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
    force?: boolean,
  ): Promise<AutocompleteOutcome | undefined> {
    try {
      // Create abort signal if not given
      if (!token) {
        const controller = this.loggingService.createAbortController(
          input.completionId,
        );
        token = controller.signal;
      }
      const startTime = Date.now();

      const llm = await this._prepareLlm();
      if (!llm) {
        return undefined;
      }

      if (isSecurityConcern(input.filepath)) {
        return undefined;
      }

      const options = await this._getAutocompleteOptions(llm);

      // Debounce
      if (!force) {
        if (
          await this.debouncer.delayAndShouldDebounce(options.debounceDelay)
        ) {
          return undefined;
        }
      }

      if (llm.promptTemplates?.autocomplete) {
        options.template = llm.promptTemplates.autocomplete as string;
      }

      const helper = await HelperVars.create(
        input,
        options,
        llm.model,
        this.ide,
      );

      if (await shouldPrefilter(helper, this.ide)) {
        return undefined;
      }

      const [snippetPayload, workspaceDirs] = await Promise.all([
        getAllSnippetsWithoutRace({
          helper,
          ide: this.ide,
          getDefinitionsFromLsp: this.getDefinitionsFromLsp,
          contextRetrievalService: this.contextRetrievalService,
        }),
        this.ide.getWorkspaceDirs(),
      ]);

      const { prompt, prefix, suffix, completionOptions } =
        renderPromptWithTokenLimit({
          snippetPayload,
          workspaceDirs,
          helper,
          llm,
        });

      // Completion
      let completion: string | undefined = "";
      const cache = await this.getCache();
      const cachedCompletion = helper.options.useCache
        ? await cache.get(helper.prunedPrefix)
        : undefined;
      let cacheHit = false;
      if (cachedCompletion) {
        cacheHit = true;
        completion = cachedCompletion;
      } else {
        const multiline =
          !helper.options.transform || shouldCompleteMultiline(helper);

        const completionStream =
          this.completionStreamer.streamCompletionWithFilters(
            token,
            llm,
            prefix,
            suffix,
            prompt,
            multiline,
            completionOptions,
            helper,
          );

        for await (const update of completionStream) {
          completion += update;
        }

        // Don't postprocess if aborted
        if (token.aborted) {
          return undefined;
        }

        const processedCompletion = helper.options.transform
          ? postprocessCompletion({
              completion,
              prefix: helper.prunedPrefix,
              suffix: helper.prunedSuffix,
              llm,
            })
          : completion;

        completion = processedCompletion;
      }

      if (!completion) {
        return undefined;
      }

      const outcome: AutocompleteOutcome = {
        time: Date.now() - startTime,
        completion,
        prefix,
        suffix,
        prompt,
        modelProvider: llm.underlyingProviderName,
        modelName: llm.model,
        completionOptions,
        cacheHit,
        filepath: helper.filepath,
        numLines: completion.split("\n").length,
        completionId: helper.input.completionId,
        gitRepo: await this.ide.getRepoName(helper.filepath),
        uniqueId: await this.ide.getUniqueId(),
        timestamp: new Date().toISOString(),
        profileType:
          this.configHandler.currentProfile?.profileDescription.profileType,
        ...helper.options,
      };

      if (options.experimental_enableStaticContextualization) {
        outcome.enabledStaticContextualization = true;
      }

      if (!outcome.cacheHit && helper.options.useCache) {
        void cache
          .put(outcome.prefix, outcome.completion)
          .catch((e) => console.warn(`Failed to save to cache: ${e.message}`));
      }

      const ideType = (await this.ide.getIdeInfo()).ideType;
      if (ideType === "jetbrains") {
        this.markDisplayed(input.completionId, outcome);
      }

      return outcome;
    } catch (e: any) {
      this.onError(e);
    } finally {
      this.loggingService.deleteAbortController(input.completionId);
    }
  }

  public async dispose() {
    if (this.autocompleteCache) {
      await this.autocompleteCache.close();
    }
  }
}
