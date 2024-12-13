import { ConfigHandler } from "../config/ConfigHandler.js";
import { TRIAL_FIM_MODEL } from "../config/onboarding.js";
import { IDE, ILLM } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { PosthogFeatureFlag, Telemetry } from "../util/posthog.js";

import { shouldCompleteMultiline } from "./classification/shouldCompleteMultiline.js";
import { ContextRetrievalService } from "./context/ContextRetrievalService.js";
// @prettier-ignore

import { BracketMatchingService } from "./filtering/BracketMatchingService.js";
import { CompletionStreamer } from "./generation/CompletionStreamer.js";
import { postprocessCompletion } from "./postprocessing/index.js";
import { shouldPrefilter } from "./prefiltering/index.js";
import { getAllSnippets } from "./snippets/index.js";
import {
  DEFAULT_AUTOCOMPLETE_OPTS,
  TabAutocompleteOptions,
} from "./TabAutocompleteOptions.js";
import { renderPrompt } from "./templating/index.js";
import { AutocompleteContext } from "./util/AutocompleteContext.js";
import { AutocompleteDebouncer } from "./util/AutocompleteDebouncer.js";
import { AutocompleteLoggingService } from "./util/AutocompleteLoggingService.js";
import AutocompleteLruCache from "./util/AutocompleteLruCache.js";
import { AutocompleteInput, AutocompleteOutcome } from "./util/types.js";

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
  "operation was aborted",
];

export class CompletionProvider {
  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();
  private debouncer = new AutocompleteDebouncer();
  private completionStreamer: CompletionStreamer;
  private loggingService = new AutocompleteLoggingService();
  private contextRetrievalService: ContextRetrievalService;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly injectedGetLlm: () => Promise<ILLM | undefined>,
    private readonly onErrorCallback: (e: any) => void,
    private readonly writeLog: (text: string) => void = () => {},
  ) {
    this.completionStreamer = new CompletionStreamer(this.onError.bind(this));
    this.contextRetrievalService = new ContextRetrievalService(this.ide);
  }

  private async prepareLlm(): Promise<ILLM | undefined> {
    const llm = await this.injectedGetLlm();

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
      const value = await Telemetry.getValueForFeatureFlag(
        PosthogFeatureFlag.AutocompleteTemperature,
      );

      llm.completionOptions.temperature = value ?? 0.01;
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
      this.onErrorCallback(e);
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

  private async getAutocompleteOptions(): Promise<TabAutocompleteOptions> {
    const config = await this.configHandler.loadConfig();
    const options: TabAutocompleteOptions = {
      ...DEFAULT_AUTOCOMPLETE_OPTS,
      ...config.tabAutocompleteOptions,
      defaultLanguageOptions: {
        ...DEFAULT_AUTOCOMPLETE_OPTS.defaultLanguageOptions,
        ...config.tabAutocompleteOptions?.defaultLanguageOptions,
      },
      languageOptions: {
        ...DEFAULT_AUTOCOMPLETE_OPTS.languageOptions,
        ...config.tabAutocompleteOptions?.languageOptions,
      },
    };
    return options;
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
  ): Promise<AutocompleteOutcome | undefined> {
    try {
      const startTime = Date.now();
      const options = await this.getAutocompleteOptions();

      // Debounce
      if (await this.debouncer.delayAndShouldDebounce(options.debounceDelay)) {
        return undefined;
      }

      const llm = await this.prepareLlm();
      if (!llm) {
        return undefined;
      }

      const ctx = await AutocompleteContext.create(
        input,
        options,
        llm.model,
        this.ide,
        this.writeLog,
      );

      if (await shouldPrefilter(ctx, this.ide)) {
        return undefined;
      }

      // Create abort signal if not given
      if (!token) {
        const controller = this.loggingService.createAbortController(
          input.completionId,
        );
        token = controller.signal;
      }

      const [snippets, workspaceDirs] = await Promise.all([
        getAllSnippets(ctx, this.ide, this.contextRetrievalService),
        this.ide.getWorkspaceDirs(),
      ]);

      const { prompt, prefix, suffix, completionOptions } = renderPrompt({
        snippets,
        workspaceDirs,
        helper: ctx,
      });

      // Completion
      let completion: string | undefined = "";

      const cache = await this.autocompleteCache;
      const cachedCompletion = ctx.options.useCache
        ? await cache.get(ctx.prunedPrefix)
        : undefined;
      let cacheHit = false;
      if (cachedCompletion) {
        // Cache
        cacheHit = true;
        completion = cachedCompletion;
        if (ctx.options.logCompletionCache)
          ctx.writeLog("Using cached completion");
      } else {
        const multiline =
          !ctx.options.transform || shouldCompleteMultiline(ctx);

        const completionStream =
          this.completionStreamer.streamCompletionWithFilters(
            token,
            llm,
            prefix,
            suffix,
            prompt,
            multiline,
            completionOptions,
            ctx,
          );

        for await (const update of completionStream) {
          completion += update;
        }

        // Don't postprocess if aborted
        if (token.aborted) {
          return undefined;
        }

        const processedCompletion = ctx.options.transform
          ? postprocessCompletion({
              completion,
              prefix: ctx.prunedPrefix,
              suffix: ctx.prunedSuffix,
              llm,
              ctx,
            })
          : completion;

        completion = processedCompletion;
      }

      if (ctx.options.logCompletionOutcome) {
        ctx.writeLog("Completion Outcome: \n---\n" + completion + "\n---");
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
        modelProvider: llm.providerName,
        modelName: llm.model,
        completionOptions,
        cacheHit,
        filepath: ctx.filepath,
        completionId: ctx.input.completionId,
        gitRepo: await this.ide.getRepoName(ctx.filepath),
        uniqueId: await this.ide.getUniqueId(),
        timestamp: Date.now(),
        ...ctx.options,
      };

      //////////

      // Save to cache
      if (!outcome.cacheHit && ctx.options.useCache) {
        (await this.autocompleteCache).put(outcome.prefix, outcome.completion);
      }

      // When using the JetBrains extension, Mark as displayed
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
}
