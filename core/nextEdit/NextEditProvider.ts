import { ConfigHandler } from "../config/ConfigHandler.js";
import { ChatMessage, IDE, ILLM } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";

import { ContextRetrievalService } from "../autocomplete/context/ContextRetrievalService.js";

import { BracketMatchingService } from "../autocomplete/filtering/BracketMatchingService.js";
import { CompletionStreamer } from "../autocomplete/generation/CompletionStreamer.js";
import { shouldPrefilter } from "../autocomplete/prefiltering/index.js";
import { getAllSnippetsWithoutRace } from "../autocomplete/snippets/index.js";
import { GetLspDefinitionsFunction } from "../autocomplete/types.js";
import { AutocompleteDebouncer } from "../autocomplete/util/AutocompleteDebouncer.js";
import { AutocompleteLoggingService } from "../autocomplete/util/AutocompleteLoggingService.js";
import AutocompleteLruCache from "../autocomplete/util/AutocompleteLruCache.js";
import { HelperVars } from "../autocomplete/util/HelperVars.js";
import {
  AutocompleteInput,
  AutocompleteOutcome,
} from "../autocomplete/util/types.js";
import { replaceEscapedCharacters } from "../util/text.js";
import {
  Prompt,
  renderDefaultSystemPrompt,
  renderDefaultUserPrompt,
  renderFineTunedBasicUserPrompt,
} from "./templating/NextEditPromptEngine.js";
// import { renderPrompt } from "./templating/NextEditPromptEngine.js";

const autocompleteCache = AutocompleteLruCache.get();

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
  "operation was aborted",
];

export class NextEditProvider {
  private static instance: NextEditProvider | null = null;

  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();
  private debouncer = new AutocompleteDebouncer();
  private completionStreamer: CompletionStreamer;
  private loggingService = new AutocompleteLoggingService();
  private contextRetrievalService: ContextRetrievalService;
  private endpointType: "default" | "fineTuned";
  private diffContext: string = "";

  private constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly _injectedGetLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: GetLspDefinitionsFunction,
    endpointType: "default" | "fineTuned",
  ) {
    this.completionStreamer = new CompletionStreamer(this.onError.bind(this));
    this.contextRetrievalService = new ContextRetrievalService(this.ide);
    this.endpointType = endpointType;
  }

  public static initialize(
    configHandler: ConfigHandler,
    ide: IDE,
    injectedGetLlm: () => Promise<ILLM | undefined>,
    onError: (e: any) => void,
    getDefinitionsFromLsp: GetLspDefinitionsFunction,
    endpointType: "default" | "fineTuned",
  ): NextEditProvider {
    if (!NextEditProvider.instance) {
      NextEditProvider.instance = new NextEditProvider(
        configHandler,
        ide,
        injectedGetLlm,
        onError,
        getDefinitionsFromLsp,
        endpointType,
      );
    }
    return NextEditProvider.instance;
  }

  public static getInstance(): NextEditProvider {
    if (!NextEditProvider.instance) {
      throw new Error(
        "NextEditProvider has not been initialized. Call initialize() first.",
      );
    }
    return NextEditProvider.instance;
  }

  public addDiffToContext(diff: string): void {
    this.diffContext = diff;
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
    // TODO: Resolve import error with TRIAL_FIM_MODEL
    // else if (
    //   llm.providerName === "free-trial" &&
    //   llm.model !== TRIAL_FIM_MODEL
    // ) {
    //   llm.model = TRIAL_FIM_MODEL;
    // }

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
    const { config } = await this.configHandler.loadConfig();
    const options = {
      ...DEFAULT_AUTOCOMPLETE_OPTS,
      ...config?.tabAutocompleteOptions,
    };
    return options;
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
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
      const options = await this._getAutocompleteOptions();

      // Debounce
      if (await this.debouncer.delayAndShouldDebounce(options.debounceDelay)) {
        return undefined;
      }

      const llm = await this._prepareLlm();
      if (!llm) {
        return undefined;
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

      // TODO: Toggle between the default endpoint and the finetuned endpoint.
      const prompts: Prompt[] = [];

      if (this.endpointType === "default") {
        prompts.push(renderDefaultSystemPrompt());
        prompts.push(renderDefaultUserPrompt(snippetPayload, helper));
      } else {
        prompts.push(
          // await renderFineTunedUserPrompt(snippetPayload, this.ide, helper),
          await renderFineTunedBasicUserPrompt(
            snippetPayload,
            this.ide,
            helper,
            this.diffContext,
          ),
        );
      }

      if (this.endpointType === "default") {
        const msg: ChatMessage = await llm.chat(prompts, token);
        if (typeof msg.content === "string") {
          const nextCompletion = JSON.parse(msg.content).newCode;

          const outcomeNext: AutocompleteOutcome = {
            time: Date.now() - startTime,
            completion: nextCompletion,
            prefix: "",
            suffix: "",
            prompt: "",
            modelProvider: llm.underlyingProviderName,
            modelName: llm.model,
            completionOptions: null,
            cacheHit: false,
            filepath: helper.filepath,
            numLines: nextCompletion.split("\n").length,
            completionId: helper.input.completionId,
            gitRepo: await this.ide.getRepoName(helper.filepath),
            uniqueId: await this.ide.getUniqueId(),
            timestamp: Date.now(),
            ...helper.options,
          };
          return outcomeNext;
        } else {
          return undefined;
        }
        // const body = {
        //   model: defaultModel,
        //   messages: prompts,
        //   // max_tokens: 15000,
        //   // stop: ["<|editable_region_end|>"],
        // };
        //
        // const resp = await fetch(defaultEndpoint, {
        //   method: "POST",
        //   headers: {
        //     Authorization: `Bearer ${mercuryToken} `,
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify(body),
        // });
        //
        // const respJson = await resp.json();

        // TODO: Do some zod schema validation here if needed.
      } else {
        // const testController = new AbortController();
        // const msg: ChatMessage = await llm.chat(prompts, testController.signal);
        // const testToken = testController.signal;
        const msg: ChatMessage = await llm.chat(prompts, token);
        if (typeof msg.content === "string") {
          // TODO: There are cases where msg.conetnt.split("<|start|>")[1] is undefined
          const nextCompletion = replaceEscapedCharacters(
            msg.content.split("<|editable_region_start|>\n")[1],
          ).replace(/\n$/, "");

          // const diffLines = myersDiff(helper.fileContents, nextCompletion);

          // const diff = getRenderableDiff(diffLines);

          const outcomeNext: AutocompleteOutcome = {
            time: Date.now() - startTime,
            completion: nextCompletion,
            prefix: "",
            suffix: "",
            prompt: "",
            modelProvider: llm.underlyingProviderName,
            modelName: llm.model,
            completionOptions: null,
            cacheHit: false,
            filepath: helper.filepath,
            numLines: nextCompletion.split("\n").length,
            completionId: helper.input.completionId,
            gitRepo: await this.ide.getRepoName(helper.filepath),
            uniqueId: await this.ide.getUniqueId(),
            timestamp: Date.now(),
            ...helper.options,
          };
          return outcomeNext;
        } else {
          return undefined;
        }
        // const body = {
        //   model: fineTunedModel,
        //   messages: prompts,
        //   max_tokens: 15000,
        //   stop: ["<|editable_region_end|>"],
        // };
        //
        // const resp = await fetch(fineTunedEndpoint, {
        //   method: "POST",
        //   headers: {
        //     Authorization: `Bearer ${mercuryToken} `,
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify(body),
        // });
        //
        // const respJson = await resp.json();
        //
        // const nextCompletion = respJson.choices[0].message.content
        //   .split("<|editable_region_start|>\n")[1]
        //   .split("<|editable_region_end|>")[0]
        //   .slice(1)
        //   .slice(0, -1)
        //   .replaceAll("\\n", "\n")
        //   .replaceAll('\\"', '"');
        //
        // const outcomeNext: AutocompleteOutcome = {
        //   time: Date.now() - startTime,
        //   completion: nextCompletion,
        //   prefix: "",
        //   suffix: "",
        //   prompt: "",
        //   modelProvider: llm.underlyingProviderName,
        //   modelName: llm.model,
        //   completionOptions: null,
        //   cacheHit: false,
        //   filepath: helper.filepath,
        //   numLines: nextCompletion.split("\n").length,
        //   completionId: helper.input.completionId,
        //   gitRepo: await this.ide.getRepoName(helper.filepath),
        //   uniqueId: await this.ide.getUniqueId(),
        //   timestamp: Date.now(),
        //   ...helper.options,
        // };
        // return outcomeNext;
      }

      // // Completion
      // let completion: string | undefined = "";

      // const cache = await autocompleteCache;
      // const cachedCompletion = helper.options.useCache
      //   ? await cache.get(helper.prunedPrefix)
      //   : undefined;
      // let cacheHit = false;
      // if (cachedCompletion) {
      //   // Cache
      //   cacheHit = true;
      //   completion = cachedCompletion;
      // } else {
      //   const multiline =
      //     !helper.options.transform || shouldCompleteMultiline(helper);

      //   const completionStream =
      //     this.completionStreamer.streamCompletionWithFilters(
      //       token,
      //       llm,
      //       prefix,
      //       suffix,
      //       prompt,
      //       multiline,
      //       completionOptions,
      //       helper,
      //     );

      //   for await (const update of completionStream) {
      //     completion += update;
      //   }

      //   // Don't postprocess if aborted
      //   if (token.aborted) {
      //     return undefined;
      //   }

      //   const processedCompletion = helper.options.transform
      //     ? postprocessCompletion({
      //         completion,
      //         prefix: helper.prunedPrefix,
      //         suffix: helper.prunedSuffix,
      //         llm,
      //       })
      //     : completion;

      //   completion = processedCompletion;
      // }

      // if (!completion) {
      //   return undefined;
      // }

      // const outcome: AutocompleteOutcome = {
      //   time: Date.now() - startTime,
      //   completion,
      //   prefix,
      //   suffix,
      //   prompt,
      //   modelProvider: llm.underlyingProviderName,
      //   modelName: llm.model,
      //   completionOptions,
      //   cacheHit,
      //   filepath: helper.filepath,
      //   numLines: completion.split("\n").length,
      //   completionId: helper.input.completionId,
      //   gitRepo: await this.ide.getRepoName(helper.filepath),
      //   uniqueId: await this.ide.getUniqueId(),
      //   timestamp: Date.now(),
      //   ...helper.options,
      // };

      // //////////

      // // Save to cache
      // if (!outcome.cacheHit && helper.options.useCache) {
      //   (await this.autocompleteCache)
      //     .put(outcome.prefix, outcome.completion)
      //     .catch((e) => console.warn(`Failed to save to cache: ${e.message}`));
      // }

      // // When using the JetBrains extension, Mark as displayed
      // const ideType = (await this.ide.getIdeInfo()).ideType;
      // if (ideType === "jetbrains") {
      //   this.markDisplayed(input.completionId, outcome);
      // }

      // return outcome;
    } catch (e: any) {
      this.onError(e);
    } finally {
      this.loggingService.deleteAbortController(input.completionId);
    }
  }
}
