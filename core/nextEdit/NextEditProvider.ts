import { v4 as uuidv4 } from "uuid";
import { ConfigHandler } from "../config/ConfigHandler.js";
import { ChatMessage, IDE, ILLM, Range, RangeInFile } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";

import { ContextRetrievalService } from "../autocomplete/context/ContextRetrievalService.js";

import { BracketMatchingService } from "../autocomplete/filtering/BracketMatchingService.js";
import { CompletionStreamer } from "../autocomplete/generation/CompletionStreamer.js";
import { postprocessCompletion } from "../autocomplete/postprocessing/index.js";
import { shouldPrefilter } from "../autocomplete/prefiltering/index.js";
import { getAllSnippetsWithoutRace } from "../autocomplete/snippets/index.js";
import { AutocompleteCodeSnippet } from "../autocomplete/snippets/types.js";
import { GetLspDefinitionsFunction } from "../autocomplete/types.js";
import { getAst } from "../autocomplete/util/ast.js";
import { AutocompleteDebouncer } from "../autocomplete/util/AutocompleteDebouncer.js";
import AutocompleteLruCache from "../autocomplete/util/AutocompleteLruCache.js";
import { HelperVars } from "../autocomplete/util/HelperVars.js";
import { AutocompleteInput } from "../autocomplete/util/types.js";
import { isSecurityConcern } from "../indexing/ignore.js";
import { modelSupportsNextEdit } from "../llm/autodetect.js";
import { localPathOrUriToPath } from "../util/pathToUri.js";
import { EditAggregator } from "./context/aggregateEdits.js";
import { createDiff, DiffFormatType } from "./context/diffFormatting.js";
import { DocumentHistoryTracker } from "./DocumentHistoryTracker.js";
import { NextEditLoggingService } from "./NextEditLoggingService.js";
import { PrefetchQueue } from "./NextEditPrefetchQueue.js";
import { NextEditProviderFactory } from "./NextEditProviderFactory.js";
import { BaseNextEditModelProvider } from "./providers/BaseNextEditProvider.js";
import {
  ModelSpecificContext,
  NextEditOutcome,
  Prompt,
  PromptMetadata,
  RecentlyEditedRange,
} from "./types.js";

const autocompleteCache = AutocompleteLruCache.get();

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
  "operation was aborted",
];

/**
 * This is the next edit analogue to autocomplete's CompletionProvider.
 * You will see a lot of similar if not identical methods to CompletionProvider methods.
 * All logic used to live inside this class, but that became untenable quickly.
 * I moved a lot of the model-specific logic (prompt building, pre/post processing, etc.) to the BaseNextEditProvider and the children inheriting from it.
 * Keeping this class around might be a good idea because it handles lots of delicate logic such as abort signals, chains, logging, etc.
 * There being a singleton also gives a lot of guarantees about the state of the next edit state machine.
 */
export class NextEditProvider {
  private static instance: NextEditProvider | null = null;

  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();
  private debouncer = new AutocompleteDebouncer();
  private completionStreamer: CompletionStreamer;
  private loggingService: NextEditLoggingService;
  private contextRetrievalService: ContextRetrievalService;
  private endpointType: "default" | "fineTuned";
  private diffContext: string[] = [];
  private autocompleteContext: string = "";
  private promptMetadata: PromptMetadata | null = null;
  private currentEditChainId: string | null = null;
  private previousRequest: AutocompleteInput | null = null;
  private previousCompletions: NextEditOutcome[] = [];

  // Model-specific provider instance.
  private modelProvider: BaseNextEditModelProvider | null = null;

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
    this.loggingService = NextEditLoggingService.getInstance();
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
    this.diffContext.push(diff);
    if (this.diffContext.length > 5) {
      this.diffContext.shift();
    }
  }

  public addAutocompleteContext(ctx: string): void {
    this.autocompleteContext = ctx;
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
  }

  public reject(completionId: string) {
    const outcome = this.loggingService.reject(completionId);
    if (!outcome) {
      return;
    }
  }

  public markDisplayed(completionId: string, outcome: NextEditOutcome) {
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

  public chainExists(): boolean {
    return this.currentEditChainId !== null;
  }

  public getChainLength(): number {
    return this.previousCompletions.length;
  }

  public getPreviousCompletion(): NextEditOutcome | null {
    return this.previousCompletions[0];
  }

  public async deleteChain(): Promise<void> {
    PrefetchQueue.getInstance().abort();

    this.currentEditChainId = null;
    this.previousCompletions = [];

    if (this.previousRequest) {
      const fileContent = (
        await this.ide.readFile(this.previousRequest.filepath)
      ).toString();

      const ast = await getAst(this.previousRequest.filepath, fileContent);

      if (ast) {
        DocumentHistoryTracker.getInstance().push(
          localPathOrUriToPath(this.previousRequest.filepath),
          fileContent,
          ast,
        );
      }
    }
  }

  public startChain(id?: string) {
    this.currentEditChainId = id ?? uuidv4();
  }

  public getChain() {
    return this.previousCompletions;
  }

  public isStartOfChain() {
    return this.previousCompletions.length === 1;
  }

  /**
   * This is the main entry point to this class.
   */
  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
    opts?: {
      withChain: boolean;
      usingFullFileDiff: boolean;
    },
  ): Promise<NextEditOutcome | undefined> {
    if (isSecurityConcern(input.filepath)) {
      return undefined;
    }
    try {
      this.previousRequest = input;
      const {
        token: abortToken,
        startTime,
        helper,
      } = await this._initializeCompletionRequest(input, token);
      if (!helper) return undefined;

      // Create model-specific provider based on the model name.
      this.modelProvider = NextEditProviderFactory.createProvider(
        helper.modelName,
      );

      const { editableRegionStartLine, editableRegionEndLine, prompts } =
        await this._generatePrompts(helper, opts);

      return await this._handleCompletion(
        helper,
        prompts,
        abortToken,
        startTime,
        editableRegionStartLine,
        editableRegionEndLine,
        opts,
      );
    } catch (e: any) {
      this.onError(e);
    } finally {
      this.loggingService.deleteAbortController(input.completionId);
    }
  }

  private async _initializeCompletionRequest(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
  ): Promise<{
    token: AbortSignal;
    startTime: number;
    helper: HelperVars | undefined;
  }> {
    // Create abort signal if not given
    if (!token) {
      const controller = this.loggingService.createAbortController(
        input.completionId,
      );
      token = controller.signal;
    } else {
      // Token was provided externally, just track the completion.
      this.loggingService.trackPendingCompletion(input.completionId);
    }

    const startTime = Date.now();
    const options = await this._getAutocompleteOptions();

    // Debounce
    if (await this.debouncer.delayAndShouldDebounce(options.debounceDelay)) {
      return { token, startTime, helper: undefined };
    }

    const llm = await this._prepareLlm();
    if (!llm) {
      return { token, startTime, helper: undefined };
    }

    // Update pending completion with model info.
    this.loggingService.updatePendingCompletion(input.completionId, {
      modelName: llm.model,
      modelProvider: llm.providerName,
      filepath: input.filepath,
    });

    // Check model capabilities
    if (!modelSupportsNextEdit(llm.capabilities, llm.model, llm.title)) {
      console.error(`${llm.model} is not capable of next edit.`);
      return { token, startTime, helper: undefined };
    }

    if (llm.promptTemplates?.autocomplete) {
      options.template = llm.promptTemplates.autocomplete as string;
    }

    const helper = await HelperVars.create(input, options, llm.model, this.ide);

    if (await shouldPrefilter(helper, this.ide)) {
      return { token, startTime, helper: undefined };
    }

    return { token, startTime, helper };
  }

  private async _generatePrompts(
    helper: HelperVars,
    opts?: {
      withChain: boolean;
      usingFullFileDiff: boolean;
    },
  ): Promise<{
    editableRegionStartLine: number;
    editableRegionEndLine: number;
    prompts: Prompt[];
  }> {
    if (!this.modelProvider) {
      throw new Error("Model provider not initialized");
    }

    // NOTE: getAllSnippetsWithoutRace doesn't seem to incur much performance penalties when compared to getAllSnippets.
    // Use getAllSnippets if snippet gathering becomes noticably slow.
    const [snippetPayload, workspaceDirs] = await Promise.all([
      getAllSnippetsWithoutRace({
        helper,
        ide: this.ide,
        getDefinitionsFromLsp: this.getDefinitionsFromLsp,
        contextRetrievalService: this.contextRetrievalService,
      }),
      this.ide.getWorkspaceDirs(),
    ]);

    // Calculate editable region based on model and options.
    const { editableRegionStartLine, editableRegionEndLine } =
      this.modelProvider.calculateEditableRegion(
        helper,
        opts?.usingFullFileDiff ?? false,
      );

    // Build diffContext including in-progress edits
    // The finalized diffs are in this.diffContext, but we also need to include
    // any in-progress edits that haven't been finalized yet (the user's most recent typing)
    const combinedDiffContext = [...this.diffContext];
    try {
      const inProgressDiff = EditAggregator.getInstance().getInProgressDiff(
        helper.filepath,
      );
      if (inProgressDiff) {
        combinedDiffContext.push(inProgressDiff);
      }
    } catch (e) {
      // EditAggregator may not be initialized yet, ignore
    }

    // Build context for model-specific prompt generation.
    const context: ModelSpecificContext = {
      helper,
      snippetPayload,
      editableRegionStartLine,
      editableRegionEndLine,
      diffContext: combinedDiffContext,
      autocompleteContext: this.autocompleteContext,
      historyDiff: createDiff({
        beforeContent:
          DocumentHistoryTracker.getInstance().getMostRecentDocumentHistory(
            localPathOrUriToPath(helper.filepath),
          ) ?? "",
        afterContent: helper.fileContents,
        filePath: helper.filepath,
        diffType: DiffFormatType.Unified,
        contextLines: 3,
        workspaceDir: workspaceDirs[0], // Use first workspace directory
      }),
    };

    const prompts = await this.modelProvider.generatePrompts(context);

    this.promptMetadata = this.modelProvider.buildPromptMetadata(context);

    return { editableRegionStartLine, editableRegionEndLine, prompts };
  }

  private async _handleCompletion(
    helper: HelperVars,
    prompts: Prompt[],
    token: AbortSignal,
    startTime: number,
    editableRegionStartLine: number,
    editableRegionEndLine: number,
    opts?: {
      withChain: boolean;
      usingFullFileDiff: boolean;
    },
  ): Promise<NextEditOutcome | undefined> {
    if (!this.modelProvider) {
      throw new Error("Model provider not initialized");
    }

    const llm = await this._prepareLlm();
    if (!llm) return undefined;

    // Inject unique token if needed (for Mercury models).
    if (this.modelProvider.shouldInjectUniqueToken()) {
      const uniqueToken = this.modelProvider.getUniqueToken();
      if (uniqueToken) {
        const lastPrompt = prompts[prompts.length - 1];
        if (lastPrompt && typeof lastPrompt.content === "string") {
          lastPrompt.content += uniqueToken;
        }
      }
    }

    // Send prompts to LLM (using only user prompt for fine-tuned models).
    // prompts[1] extracts the user prompt from the system-user prompt pair.
    // NOTE: Stream is currently set to false, but this should ideally be a per-model flag.
    // Mercury Coder currently does not support streaming.
    const msg: ChatMessage = await llm.chat(
      this.endpointType === "fineTuned" ? [prompts[1]] : prompts,
      token,
      {
        stream: false,
      },
    );

    if (typeof msg.content !== "string") {
      return undefined;
    }

    // Extract completion using model-specific logic.
    let nextCompletion = this.modelProvider.extractCompletion(msg.content);

    // Postprocess the completion (same as autocomplete).
    const postprocessed = postprocessCompletion({
      completion: nextCompletion,
      llm,
      prefix: helper.prunedPrefix,
      suffix: helper.prunedSuffix,
    });

    // Return early if postprocessing filtered out the completion.
    if (!postprocessed) {
      return undefined;
    }

    nextCompletion = postprocessed;

    let outcome: NextEditOutcome | undefined;

    // Handle based on diff type.
    const profileType =
      this.configHandler.currentProfile?.profileDescription.profileType;

    if (opts?.usingFullFileDiff === false || !opts?.usingFullFileDiff) {
      outcome = await this.modelProvider.handlePartialFileDiff({
        helper,
        editableRegionStartLine,
        editableRegionEndLine,
        startTime,
        llm,
        nextCompletion,
        promptMetadata: this.promptMetadata!,
        ide: this.ide,
        profileType,
      });
    } else {
      outcome = await this.modelProvider.handleFullFileDiff({
        helper,
        editableRegionStartLine,
        editableRegionEndLine,
        startTime,
        llm,
        nextCompletion,
        promptMetadata: this.promptMetadata!,
        ide: this.ide,
        profileType,
      });
    }

    if (outcome) {
      // Handle NextEditProvider-specific state.
      this.previousCompletions.push(outcome);

      // Mark as displayed for JetBrains
      await this._markDisplayedIfJetBrains(helper.input.completionId, outcome);
    }

    return outcome;
  }

  private async _markDisplayedIfJetBrains(
    completionId: string,
    outcome: NextEditOutcome,
  ): Promise<void> {
    const ideType = (await this.ide.getIdeInfo()).ideType;
    if (ideType === "jetbrains") {
      this.markDisplayed(completionId, outcome);
    }
  }

  /**
   * This is a wrapper around provideInlineCompletionItems.
   * This is invoked when we call the model in the background using prefetch.
   * It's not currently used anywhere (references are not used either), but I decided to keep it in case we actually need to use prefetch.
   * You will see that calls to this method is made from NextEditPrefetchQueue.proecss(), which is wrapped in `if (!this.usingFullFileDiff)`.
   */
  public async provideInlineCompletionItemsWithChain(
    ctx: {
      completionId: string;
      manuallyPassFileContents?: string;
      manuallyPassPrefix?: string;
      selectedCompletionInfo?: {
        text: string;
        range: Range;
      };
      isUntitledFile: boolean;
      recentlyVisitedRanges: AutocompleteCodeSnippet[];
      recentlyEditedRanges: RecentlyEditedRange[];
    },
    nextEditLocation: RangeInFile,
    token: AbortSignal | undefined,
    usingFullFileDiff: boolean,
  ) {
    try {
      const previousOutcome = this.getPreviousCompletion();
      if (!previousOutcome) {
        console.log("previousOutcome is undefined");
        return undefined;
      }

      // Use the frontmost RangeInFile to build an input.
      const input = this.buildAutocompleteInputFromChain(
        previousOutcome,
        nextEditLocation,
        ctx,
      );
      if (!input) {
        console.log("input is undefined");
        return undefined;
      }

      return await this.provideInlineCompletionItems(input, token, {
        withChain: true,
        usingFullFileDiff,
      });
    } catch (e: any) {
      this.onError(e);
    }
  }

  private buildAutocompleteInputFromChain(
    previousOutcome: NextEditOutcome,
    nextEditableRegion: RangeInFile,
    ctx: {
      completionId: string;
      manuallyPassFileContents?: string;
      manuallyPassPrefix?: string;
      selectedCompletionInfo?: {
        text: string;
        range: Range;
      };
      isUntitledFile: boolean;
      recentlyVisitedRanges: AutocompleteCodeSnippet[];
      recentlyEditedRanges: RecentlyEditedRange[];
    },
  ): AutocompleteInput | undefined {
    const input: AutocompleteInput = {
      pos: {
        line: nextEditableRegion.range.start.line,
        character: nextEditableRegion.range.start.character,
      },
      filepath: previousOutcome.fileUri,
      ...ctx,
    };

    return input;
  }
}
