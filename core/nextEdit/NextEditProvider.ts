import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { ConfigHandler } from "../config/ConfigHandler.js";
import {
  ChatMessage,
  DiffLine,
  IDE,
  ILLM,
  Position,
  Range,
  RangeInFile,
} from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";

import { ContextRetrievalService } from "../autocomplete/context/ContextRetrievalService.js";

import { BracketMatchingService } from "../autocomplete/filtering/BracketMatchingService.js";
import { CompletionStreamer } from "../autocomplete/generation/CompletionStreamer.js";
import { shouldPrefilter } from "../autocomplete/prefiltering/index.js";
import {
  getAllSnippetsWithoutRace,
  SnippetPayload,
} from "../autocomplete/snippets/index.js";
import { AutocompleteCodeSnippet } from "../autocomplete/snippets/types.js";
import { GetLspDefinitionsFunction } from "../autocomplete/types.js";
import { getAst } from "../autocomplete/util/ast.js";
import { AutocompleteDebouncer } from "../autocomplete/util/AutocompleteDebouncer.js";
import AutocompleteLruCache from "../autocomplete/util/AutocompleteLruCache.js";
import { HelperVars } from "../autocomplete/util/HelperVars.js";
import { AutocompleteInput } from "../autocomplete/util/types.js";
import { myersDiff } from "../diff/myers.js";
import { modelSupportsNextEdit } from "../llm/autodetect.js";
import { countTokens } from "../llm/countTokens.js";
import { localPathOrUriToPath } from "../util/pathToUri.js";
import { replaceEscapedCharacters } from "../util/text.js";
import {
  INSTINCT_SYSTEM_PROMPT,
  MERCURY_CODE_TO_EDIT_OPEN,
  MERCURY_SYSTEM_PROMPT,
  MODEL_WINDOW_SIZES,
} from "./constants.js";
import { createDiff, DiffFormatType } from "./context/diffFormatting.js";
import {
  calculateFinalCursorPosition,
  DiffGroup,
  groupDiffLines,
} from "./diff/diff.js";
import { DocumentHistoryTracker } from "./DocumentHistoryTracker.js";
import { NextEditLoggingService } from "./NextEditLoggingService.js";
import { PrefetchQueue } from "./NextEditPrefetchQueue.js";
import {
  renderDefaultSystemPrompt,
  renderDefaultUserPrompt,
  renderPrompt,
} from "./templating/NextEditPromptEngine.js";
import {
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
  // private nextEditableRegionsInTheCurrentChain: RangeInFile[] = [];

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
    // TODO: this should be cleaned up in the prefetch queue.
    // this.nextEditableRegionsInTheCurrentChain = [];

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

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
    opts?: {
      withChain: boolean;
      usingFullFileDiff: boolean;
    },
  ): Promise<NextEditOutcome | undefined> {
    try {
      this.previousRequest = input;
      const {
        token: abortToken,
        startTime,
        helper,
      } = await this._initializeCompletionRequest(input, token);
      if (!helper) return undefined;

      const { editableRegionStartLine, editableRegionEndLine, prompts } =
        await this._generatePrompts(helper, opts);

      if (this.endpointType === "default") {
        return await this._handleDefaultEndpointCompletion(
          helper,
          prompts,
          abortToken,
          startTime,
          editableRegionEndLine,
        );
      } else {
        return await this._handleFineTunedEndpointCompletion(
          helper,
          prompts,
          abortToken,
          startTime,
          editableRegionStartLine,
          editableRegionEndLine,
          opts,
        );
      }
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
    // Create abort signal if not given.
    if (!token) {
      const controller = this.loggingService.createAbortController(
        input.completionId,
      );
      token = controller.signal;
    }
    const startTime = Date.now();
    const options = await this._getAutocompleteOptions();

    // Debounce.
    if (await this.debouncer.delayAndShouldDebounce(options.debounceDelay)) {
      return { token, startTime, helper: undefined };
    }

    const llm = await this._prepareLlm();
    if (!llm) {
      return { token, startTime, helper: undefined };
    }

    // In vscode, this check is done in extensions/vscode/src/extension/VsCodeExtension.ts.
    // For other editors, this check should be done in their respective config reloaders.
    // This is left for a final check.
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
    const [snippetPayload, workspaceDirs] = await Promise.all([
      getAllSnippetsWithoutRace({
        helper,
        ide: this.ide,
        getDefinitionsFromLsp: this.getDefinitionsFromLsp,
        contextRetrievalService: this.contextRetrievalService,
      }),
      this.ide.getWorkspaceDirs(),
    ]);

    const modelName = helper.modelName.includes("mercury-coder-nextedit")
      ? "mercury-coder-nextedit"
      : "instinct";

    const { editableRegionStartLine, editableRegionEndLine } =
      opts?.usingFullFileDiff
        ? this._calculateOptimalEditableRegion(helper, "tokenizer")
        : {
            editableRegionStartLine: Math.max(
              helper.pos.line - MODEL_WINDOW_SIZES[modelName].topMargin,
              0,
            ),
            editableRegionEndLine: Math.min(
              helper.pos.line + MODEL_WINDOW_SIZES[modelName].bottomMargin,
              helper.fileLines.length - 1,
            ),
          };

    // const editableRegionStartLine = opts?.usingFullFileDiff
    //   ? 0
    //   : Math.max(helper.pos.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN, 0);

    // const editableRegionEndLine = opts?.usingFullFileDiff
    //   ? helper.fileLines.length - 1
    //   : Math.min(
    //       helper.pos.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
    //       helper.fileLines.length - 1,
    //     );

    const prompts: Prompt[] = [];

    if (this.endpointType === "default") {
      prompts.push(renderDefaultSystemPrompt());
      prompts.push(renderDefaultUserPrompt(snippetPayload, helper));
    } else {
      prompts.push(
        ...(await this._generateFineTunedPrompts(
          helper,
          snippetPayload,
          editableRegionStartLine,
          editableRegionEndLine,
        )),
      );
    }

    return { editableRegionStartLine, editableRegionEndLine, prompts };
  }

  private _calculateOptimalEditableRegion(
    helper: HelperVars,
    heuristic: "fourChars" | "tokenizer" = "tokenizer",
  ): {
    editableRegionStartLine: number;
    editableRegionEndLine: number;
  } {
    const cursorLine = helper.pos.line;
    const fileLines = helper.fileLines;
    const MAX_TOKENS = 512;

    // Initialize with cursor line.
    let editableRegionStartLine = cursorLine;
    let editableRegionEndLine = cursorLine;

    // Get initial content and token count.
    let currentContent = fileLines[cursorLine];
    let totalTokens =
      heuristic === "tokenizer"
        ? countTokens(currentContent, helper.modelName)
        : Math.ceil(currentContent.length / 4);

    // Expand outward alternating between adding lines above and below.
    let addingAbove = true;

    while (totalTokens < MAX_TOKENS) {
      let addedLine = false;

      if (addingAbove) {
        // Try to add a line above.
        if (editableRegionStartLine > 0) {
          editableRegionStartLine--;
          const lineContent = fileLines[editableRegionStartLine];
          const lineTokens =
            heuristic === "tokenizer"
              ? countTokens(lineContent, helper.modelName)
              : Math.ceil(lineContent.length / 4);

          totalTokens += lineTokens;
          addedLine = true;
        }
      } else {
        // Try to add a line below.
        if (editableRegionEndLine < fileLines.length - 1) {
          editableRegionEndLine++;
          const lineContent = fileLines[editableRegionEndLine];
          const lineTokens =
            heuristic === "tokenizer"
              ? countTokens(lineContent, helper.modelName)
              : Math.ceil(lineContent.length / 4);

          totalTokens += lineTokens;
          addedLine = true;
        }
      }

      // If we can't add in the current direction, try the other.
      if (!addedLine) {
        // If we're already at both file boundaries, we're done.
        if (
          editableRegionStartLine === 0 &&
          editableRegionEndLine === fileLines.length - 1
        ) {
          break;
        }

        // If we couldn't add in one direction, force the next attempt in the other direction.
        addingAbove = !addingAbove;
        continue;
      }

      // If we exceeded the token limit, revert the last addition.
      if (totalTokens > MAX_TOKENS) {
        if (addingAbove) {
          editableRegionStartLine++;
        } else {
          editableRegionEndLine--;
        }
        break;
      }

      // Alternate between adding above and below for balanced context.
      addingAbove = !addingAbove;
    }

    return {
      editableRegionStartLine,
      editableRegionEndLine,
    };
  }

  private async _generateFineTunedPrompts(
    helper: HelperVars,
    snippetPayload: SnippetPayload,
    editableRegionStartLine: number,
    editableRegionEndLine: number,
  ): Promise<Prompt[]> {
    const historyDiff = createDiff({
      beforeContent:
        DocumentHistoryTracker.getInstance().getMostRecentDocumentHistory(
          localPathOrUriToPath(helper.filepath),
        ) ?? "",
      afterContent: helper.fileContents,
      filePath: helper.filepath,
      diffType: DiffFormatType.Unified,
      contextLines: 3,
    });

    const modelName = helper.modelName;
    let ctx: any;

    if (modelName.includes("mercury-coder-nextedit")) {
      ctx = {
        recentlyViewedCodeSnippets:
          snippetPayload.recentlyVisitedRangesSnippets.map((snip) => ({
            filepath: snip.filepath,
            content: snip.content,
          })) ?? [],
        currentFileContent: helper.fileContents,
        editableRegionStartLine,
        editableRegionEndLine,
        editDiffHistory: this.diffContext,
        currentFilePath: helper.filepath,
      };
    } else if (modelName.includes("instinct")) {
      // Calculate the window around the cursor position (25 lines above and below).
      const windowStart = Math.max(0, helper.pos.line - 25);
      const windowEnd = Math.min(
        helper.fileLines.length - 1,
        helper.pos.line + 25,
      );

      // // The editable region is defined as: cursor line - 1 to cursor line + 5 (inclusive).
      // const actualEditableStart = Math.max(
      //   0,
      //   helper.pos.line - MODEL_WINDOW_SIZES["instinct"].topMargin,
      // );
      // const actualEditableEnd = Math.min(
      //   helper.fileLines.length - 1,
      //   helper.pos.line + MODEL_WINDOW_SIZES["instinct"].bottomMargin,
      // );

      // Ensure editable region boundaries are within the window.
      const adjustedEditableStart = Math.max(
        windowStart,
        editableRegionStartLine,
      );
      const adjustedEditableEnd = Math.min(windowEnd, editableRegionEndLine);
      ctx = {
        contextSnippets: this.autocompleteContext,
        currentFileContent: helper.fileContents,
        windowStart,
        windowEnd,
        editableRegionStartLine: adjustedEditableStart,
        editableRegionEndLine: adjustedEditableEnd,
        editDiffHistory: this.diffContext,
        currentFilePath: helper.filepath,
        languageShorthand: helper.lang.name,
      };
    } else {
      ctx = {};
    }

    const promptMetadata = await renderPrompt(helper, ctx);
    this.promptMetadata = promptMetadata;

    const systemPrompt: Prompt = {
      role: "system",
      content: modelName.includes("mercury-coder-nextedit")
        ? MERCURY_SYSTEM_PROMPT
        : INSTINCT_SYSTEM_PROMPT,
    };

    return [systemPrompt, promptMetadata.prompt];
  }

  private async _handleDefaultEndpointCompletion(
    helper: HelperVars,
    prompts: Prompt[],
    token: AbortSignal,
    startTime: number,
    editableRegionEndLine: number,
  ): Promise<NextEditOutcome | undefined> {
    const llm = await this._prepareLlm();
    if (!llm) return undefined;

    const msg: ChatMessage = await llm.chat(prompts, token);

    if (typeof msg.content === "string") {
      const nextCompletion = JSON.parse(msg.content).newCode;
      const finalCursorPos: Position = {
        line: editableRegionEndLine,
        character: 0,
      };

      const outcomeNext = await this._createNextEditOutcome({
        helper,
        startTime,
        llm,
        promptContent: prompts.join("\n"),
        completion: nextCompletion,
        finalCursorPosition: finalCursorPos,
        editableRegionStartLine: 0,
        editableRegionEndLine: 0,
        userEdits: "",
        userExcerpts: "",
        originalEditableRange: "",
        diffLines: [],
      });

      // Mark as displayed for JetBrains extension
      await this._markDisplayedIfJetBrains(
        helper.input.completionId,
        outcomeNext,
      );

      return outcomeNext;
    }

    return undefined;
  }

  private async _handleFineTunedEndpointCompletion(
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
    const llm = await this._prepareLlm();
    if (!llm) return undefined;

    const msg: ChatMessage = await llm.chat(prompts, token);
    console.log("message");
    console.log(msg.content);

    if (typeof msg.content !== "string") {
      return undefined;
    }

    const nextCompletion = msg.content.split(
      `${MERCURY_CODE_TO_EDIT_OPEN}\n`,
    )[1]
      ? replaceEscapedCharacters(
          msg.content.split(`${MERCURY_CODE_TO_EDIT_OPEN}\n`)[1],
        ).replace(/\n$/, "")
      : replaceEscapedCharacters(msg.content);

    if (opts?.usingFullFileDiff === false || !opts?.usingFullFileDiff) {
      return await this._handlePartialFileDiff(
        // we could use fillFileDiff
        helper,
        editableRegionStartLine,
        editableRegionEndLine,
        startTime,
        llm,
        nextCompletion,
      );
    } else {
      return await this._handleFullFileDiff(
        helper,
        editableRegionStartLine,
        editableRegionEndLine,
        startTime,
        llm,
        nextCompletion,
      );
    }
  }

  private async _handlePartialFileDiff(
    helper: HelperVars,
    editableRegionStartLine: number,
    editableRegionEndLine: number,
    startTime: number,
    llm: ILLM,
    nextCompletion: string,
  ): Promise<NextEditOutcome | undefined> {
    const oldEditRangeSlice = helper.fileContents
      .split("\n")
      .slice(editableRegionStartLine, editableRegionEndLine + 1)
      .join("\n");

    const finalCursorPos = calculateFinalCursorPosition(
      helper.pos,
      editableRegionStartLine,
      oldEditRangeSlice,
      nextCompletion,
    );

    const outcomeNext = await this._createNextEditOutcome({
      helper,
      startTime,
      llm,
      promptContent: this.promptMetadata!.prompt.content,
      completion: nextCompletion,
      finalCursorPosition: finalCursorPos,
      editableRegionStartLine,
      editableRegionEndLine,
      userEdits: this.promptMetadata!.userEdits,
      userExcerpts: this.promptMetadata!.userExcerpts,
      originalEditableRange: oldEditRangeSlice,
      diffLines: [],
    });

    this.previousCompletions.push(outcomeNext);

    // Mark as displayed for JetBrains extension
    await this._markDisplayedIfJetBrains(
      helper.input.completionId,
      outcomeNext,
    );

    return outcomeNext;
  }

  private async _handleFullFileDiff(
    helper: HelperVars,
    editableRegionStartLine: number,
    editableRegionEndLine: number,
    startTime: number,
    llm: ILLM,
    nextCompletion: string,
  ): Promise<NextEditOutcome | undefined> {
    const fileSlice = helper.fileLines
      .slice(editableRegionStartLine, editableRegionEndLine + 1)
      .join("\n");
    const diffLines = myersDiff(fileSlice, nextCompletion);
    const diffGroups = groupDiffLines(diffLines, editableRegionStartLine, 5);
    const currentLine = helper.pos.line;
    let cursorLocalDiffGroup: DiffGroup | undefined;
    const prefetchQueue = PrefetchQueue.getInstance();

    // Process diff groups and find the one containing the cursor
    await this._processDiffGroups(
      diffGroups,
      currentLine,
      helper,
      startTime,
      llm,
      prefetchQueue,
    );

    // Handle the diff group containing the cursor if found
    if (cursorLocalDiffGroup) {
      return await this._createOutcomeFromDiffGroup(
        cursorLocalDiffGroup,
        helper,
        startTime,
        llm,
        helper.input.completionId,
        true,
      );
    } else if (diffGroups.length > 0) {
      // Fallback to first diff group if cursor's group not found
      return await this._createOutcomeFromDiffGroup(
        diffGroups[0],
        helper,
        startTime,
        llm,
        helper.input.completionId,
        false,
      );
    }

    return undefined;
  }

  private async _processDiffGroups(
    diffGroups: DiffGroup[],
    currentLine: number,
    helper: HelperVars,
    startTime: number,
    llm: ILLM,
    prefetchQueue: PrefetchQueue,
  ): Promise<DiffGroup | undefined> {
    let cursorGroup: DiffGroup | undefined;

    console.log("diffGroups:");
    console.log(diffGroups);

    for (const group of diffGroups) {
      if (currentLine >= group.startLine && currentLine <= group.endLine) {
        cursorGroup = group;
      } else {
        // Add non-cursor groups to prefetch queue
        await this._addDiffGroupToPrefetchQueue(
          group,
          helper,
          startTime,
          llm,
          prefetchQueue,
        );
      }
    }

    return cursorGroup;
  }

  private async _addDiffGroupToPrefetchQueue(
    group: DiffGroup,
    helper: HelperVars,
    startTime: number,
    llm: ILLM,
    prefetchQueue: PrefetchQueue,
  ): Promise<void> {
    const groupContent = group.lines
      .filter((l) => l.type !== "old")
      .map((l) => l.line)
      .join("\n");

    // Create a range for this diff group
    const rangeInFile: RangeInFile = {
      filepath: helper.filepath,
      range: {
        start: { line: group.startLine, character: 0 },
        end: {
          line: group.endLine,
          character: group.lines[group.lines.length - 1].line.length,
        },
      },
    };

    const originalContent = group.lines
      .filter((l) => l.type !== "new")
      .map((l) => l.line)
      .join("\n");

    // Build outcome for this diff group
    const groupOutcome = await this._createNextEditOutcome({
      helper,
      startTime,
      llm,
      promptContent: this.promptMetadata!.prompt.content,
      completion: groupContent,
      finalCursorPosition: {
        line: group.endLine,
        character: group.lines[group.lines.length - 1].line.length,
      },
      editableRegionStartLine: group.startLine,
      editableRegionEndLine: group.endLine,
      userEdits: this.promptMetadata!.userEdits,
      userExcerpts: this.promptMetadata!.userExcerpts,
      originalEditableRange: originalContent,
      cursorPosition: { line: group.startLine, character: 0 },
      completionId: uuidv4(), // Generate a new ID for this prefetched item
      diffLines: group.lines,
    });

    // Add to prefetch queue
    prefetchQueue.enqueueProcessed({
      location: rangeInFile,
      outcome: groupOutcome,
    });
  }

  private async _createOutcomeFromDiffGroup(
    diffGroup: DiffGroup,
    helper: HelperVars,
    startTime: number,
    llm: ILLM,
    completionId: string,
    isCurrentCursorGroup: boolean,
  ): Promise<NextEditOutcome> {
    const groupContent = diffGroup.lines
      .filter((l) => l.type !== "old")
      .map((line) => line.line)
      .join("\n");

    const originalContent = diffGroup.lines
      .filter((l) => l.type !== "new")
      .map((l) => l.line)
      .join("\n");

    // Use the actual cursor position if this is the group containing the cursor
    // Otherwise use the start of the diff group
    const cursorPos = isCurrentCursorGroup
      ? helper.pos
      : { line: diffGroup.startLine, character: 0 };

    const finalCursorPos = calculateFinalCursorPosition(
      cursorPos,
      diffGroup.startLine,
      originalContent,
      groupContent,
    );

    const outcomeNext = await this._createNextEditOutcome({
      helper,
      startTime,
      llm,
      promptContent: this.promptMetadata!.prompt.content,
      completion: groupContent,
      finalCursorPosition: finalCursorPos,
      editableRegionStartLine: diffGroup.startLine,
      editableRegionEndLine: diffGroup.endLine,
      userEdits: this.promptMetadata!.userEdits,
      userExcerpts: this.promptMetadata!.userExcerpts,
      originalEditableRange: originalContent,
      cursorPosition: cursorPos,
      completionId,
      diffLines: diffGroup.lines,
    });

    this.previousCompletions.push(outcomeNext);

    // Mark as displayed for JetBrains
    await this._markDisplayedIfJetBrains(completionId, outcomeNext);

    return outcomeNext;
  }

  private async _createNextEditOutcome(outcomeCtx: {
    helper: HelperVars;
    startTime: number;
    llm: ILLM;
    promptContent: string;
    completion: string;
    finalCursorPosition: Position;
    editableRegionStartLine: number;
    editableRegionEndLine: number;
    userEdits: string;
    userExcerpts: string;
    originalEditableRange: string;
    cursorPosition?: Position;
    completionId?: string;
    diffLines: DiffLine[];
  }): Promise<NextEditOutcome> {
    return {
      elapsed: Date.now() - outcomeCtx.startTime,
      modelProvider: outcomeCtx.llm.underlyingProviderName,
      modelName: outcomeCtx.llm.model + ":zetaDataset",
      completionOptions: null,
      completionId:
        outcomeCtx.completionId || outcomeCtx.helper.input.completionId,
      gitRepo: await this.ide.getRepoName(outcomeCtx.helper.filepath),
      uniqueId: await this.ide.getUniqueId(),
      timestamp: Date.now(),
      fileUri: outcomeCtx.helper.filepath,
      workspaceDirUri:
        outcomeCtx.helper.workspaceUris[0] ??
        path.dirname(outcomeCtx.helper.filepath),
      prompt: outcomeCtx.promptContent,
      userEdits: outcomeCtx.userEdits ?? "",
      userExcerpts: outcomeCtx.userExcerpts ?? "",
      originalEditableRange: outcomeCtx.originalEditableRange ?? "",
      completion: outcomeCtx.completion,
      cursorPosition: outcomeCtx.cursorPosition || outcomeCtx.helper.pos,
      finalCursorPosition: outcomeCtx.finalCursorPosition,
      editableRegionStartLine: outcomeCtx.editableRegionStartLine,
      editableRegionEndLine: outcomeCtx.editableRegionEndLine,
      diffLines: outcomeCtx.diffLines,
      ...outcomeCtx.helper.options,
    };
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
