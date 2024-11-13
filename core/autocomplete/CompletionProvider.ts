import { ConfigHandler } from "../config/ConfigHandler.js";
import { TRIAL_FIM_MODEL } from "../config/onboarding.js";
import { IDE, ILLM } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";

import { shouldCompleteMultiline } from "./classification/shouldCompleteMultiline.js";
import { AutocompleteLanguageInfo } from "./constants/AutocompleteLanguageInfo.js";
import { constructAutocompletePrompt } from "./constructPrompt.js";
// @prettier-ignore

import { ContextRetrievalService } from "./context/ContextRetrievalService.js";
import { AutocompleteSnippet } from "./context/ranking/index.js";
import { BracketMatchingService } from "./filtering/BracketMatchingService.js";
import { CompletionStreamer } from "./generation/CompletionStreamer.js";
import { postprocessCompletion } from "./postprocessing/index.js";
import { shouldPrefilter } from "./prefiltering/index.js";
import { renderPrompt } from "./templating/index.js";
import { AutocompleteDebouncer } from "./util/AutocompleteDebouncer.js";
import { AutocompleteLoggingService } from "./util/AutocompleteLoggingService.js";
import AutocompleteLruCache from "./util/AutocompleteLruCache.js";
import { HelperVars } from "./util/HelperVars.js";
import { AutocompleteInput, AutocompleteOutcome } from "./util/types.js";

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
    private readonly _injectedGetLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: GetLspDefinitionsFunction,
  ) {
    this.completionStreamer = new CompletionStreamer(this.onError.bind(this));
    this.contextRetrievalService = new ContextRetrievalService(this.ide);
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
      const startTime = Date.now();
      const options = await this._getAutocompleteOptions();

      // Debounce
      if (await this.debouncer.delayAndShouldDebounce(options.debounceDelay)) {
        return undefined;
      }

      const llm = await this._prepareLlm();
      if (!llm) {
        return undefined;
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

      // Create abort signal if not given
      if (!token) {
        const controller = this.loggingService.createAbortController(
          input.completionId,
        );
        token = controller.signal;
      }

      //////////

      // Some IDEs might have special ways of finding snippets (e.g. JetBrains and VS Code have different "LSP-equivalent" systems,
      // or they might separately track recently edited ranges)
      const extraSnippets = await this._getExtraSnippets(helper);

      let snippets = await constructAutocompletePrompt(
        helper,
        extraSnippets,
        this.contextRetrievalService,
      );

      const { prompt, prefix, suffix, completionOptions } = renderPrompt(
        snippets,
        await this.ide.getWorkspaceDirs(),
        helper,
      );

      // Completion
      let completion: string | undefined = "";

      const cache = await autocompleteCache;
      const cachedCompletion = helper.options.useCache
        ? await cache.get(helper.prunedPrefix)
        : undefined;
      let cacheHit = false;
      if (cachedCompletion) {
        // Cache
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
        modelProvider: llm.providerName,
        modelName: llm.model,
        completionOptions,
        cacheHit,
        filepath: helper.filepath,
        completionId: helper.input.completionId,
        gitRepo: await this.ide.getRepoName(helper.filepath),
        uniqueId: await this.ide.getUniqueId(),
        timestamp: Date.now(),
        ...helper.options,
      };

      //////////

      // Save to cache
      if (!outcome.cacheHit) {
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

  private async _getExtraSnippets(
    helper: HelperVars,
  ): Promise<AutocompleteSnippet[]> {
    let extraSnippets = helper.options.useOtherFiles
      ? ((await Promise.race([
          this.getDefinitionsFromLsp(
            helper.input.filepath,
            helper.fullPrefix + helper.fullSuffix,
            helper.fullPrefix.length,
            this.ide,
            helper.lang,
          ),
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 100);
          }),
        ])) as AutocompleteSnippet[])
      : [];

    const workspaceDirs = await this.ide.getWorkspaceDirs();
    if (helper.options.onlyMyCode) {
      extraSnippets = extraSnippets.filter((snippet) => {
        return workspaceDirs.some((dir) => snippet.filepath.startsWith(dir));
      });
    }

    return extraSnippets;
  }
}
