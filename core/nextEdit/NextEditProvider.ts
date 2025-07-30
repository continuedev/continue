import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { ConfigHandler } from "../config/ConfigHandler.js";
import { ChatMessage, IDE, ILLM, Range, RangeInFile } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";

import { ContextRetrievalService } from "../autocomplete/context/ContextRetrievalService.js";

import { BracketMatchingService } from "../autocomplete/filtering/BracketMatchingService.js";
import { CompletionStreamer } from "../autocomplete/generation/CompletionStreamer.js";
import { shouldPrefilter } from "../autocomplete/prefiltering/index.js";
import { getAllSnippetsWithoutRace } from "../autocomplete/snippets/index.js";
import { AutocompleteCodeSnippet } from "../autocomplete/snippets/types.js";
import { GetLspDefinitionsFunction } from "../autocomplete/types.js";
import { getAst } from "../autocomplete/util/ast.js";
import { AutocompleteDebouncer } from "../autocomplete/util/AutocompleteDebouncer.js";
import AutocompleteLruCache from "../autocomplete/util/AutocompleteLruCache.js";
import { HelperVars } from "../autocomplete/util/HelperVars.js";
import { AutocompleteInput } from "../autocomplete/util/types.js";
import { localPathOrUriToPath } from "../util/pathToUri.js";
import { replaceEscapedCharacters } from "../util/text.js";
import {
  CODE_TO_EDIT_OPEN,
  NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
  NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
} from "./constants.js";
import { createDiff, DiffFormatType } from "./context/diffFormatting.js";
import { calculateFinalCursorPosition } from "./diff/diff.js";
import { DocumentHistoryTracker } from "./DocumentHistoryTracker.js";
import {
  EditableRegionStrategy,
  getNextEditableRegion,
} from "./NextEditEditableRegionCalculator.js";
import { NextEditLoggingService } from "./NextEditLoggingService.js";
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
  private diffContext: string = "";
  private promptMetadata: PromptMetadata | null = null;
  private currentEditChainId: string | null = null;
  private previousRequest: AutocompleteInput | null = null;
  private previousCompletions: NextEditOutcome[] = [];
  private nextEditableRegionsInTheCurrentChain: RangeInFile[] = [];

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
    this.currentEditChainId = null;
    this.previousCompletions = [];
    this.nextEditableRegionsInTheCurrentChain = [];

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
    },
  ): Promise<NextEditOutcome | undefined> {
    try {
      this.previousRequest = input;
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

      // Depending on whether this method is called from provideInlineCompletionItemsWithChain,
      // shift the next editable regions.
      // This is handled here because this must run after the debouncer
      // to prevent excessive shifts.
      if (opts?.withChain) {
        this.shiftNextEditableRegionsInTheCurrentChain();
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

      const editableRegionStartLine = Math.max(
        helper.pos.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
        0,
      );

      const editableRegionEndLine = Math.min(
        helper.pos.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
        helper.fileLines.length - 1,
      );

      // TODO: Toggle between the default endpoint and the finetuned endpoint.
      const prompts: Prompt[] = [];

      if (this.endpointType === "default") {
        prompts.push(renderDefaultSystemPrompt());
        prompts.push(renderDefaultUserPrompt(snippetPayload, helper));
      } else {
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
            editDiffHistory: historyDiff,
          };
        } else if (modelName.includes("model-1")) {
          ctx = {
            userEdits: historyDiff ?? this.diffContext,
            languageShorthand: helper.lang.name,
            userExcerpts: helper.fileContents,
          };
        } else {
          ctx = {};
        }

        const promptMetadata = await renderPrompt(
          helper,
          ctx,
        );

        this.promptMetadata = promptMetadata;

        // prompts.push({
        //   role: "system",
        //   content: [
        //     "When the user deletes or replaces over previous code, you should respect that decision.",
        //     "Respect the new code the user is writing, and complete it.",
        //     "For example, if the user is changing a field name, try to autocomplete the new field name. Don't suggest the previous field name.",
        //     "Do not roll back to previous content.",
        //     "If the user has made a change, make sure you respect that and try to apply it to other parts of the code that used to use the old content.",
        //   ].join("\n"),
        // });

        prompts.push(promptMetadata.prompt);
      }

      const oldEditRangeSlice = helper.fileContents
        .split("\n")
        .slice(editableRegionStartLine, editableRegionEndLine + 1)
        .join("\n");

      const finalCursorPos = calculateFinalCursorPosition(
        helper.pos,
        editableRegionStartLine,
        oldEditRangeSlice,
        "",
      );

      if (this.endpointType === "default") {
        const msg: ChatMessage = await llm.chat(prompts, token);

        if (typeof msg.content === "string") {
          const nextCompletion = JSON.parse(msg.content).newCode;
          const outcomeNext: NextEditOutcome = {
            elapsed: Date.now() - startTime,
            modelProvider: llm.underlyingProviderName,
            modelName: llm.model + ":zetaDataset",
            completionOptions: null,
            completionId: helper.input.completionId,
            gitRepo: await this.ide.getRepoName(helper.filepath),
            uniqueId: await this.ide.getUniqueId(),
            timestamp: Date.now(),
            fileUri: helper.filepath,
            workspaceDirUri:
              helper.workspaceUris[0] ?? path.dirname(helper.filepath),
            prompt: prompts.join("\n"),
            userEdits: "",
            userExcerpts: "",
            originalEditableRange: "",
            completion: nextCompletion,
            cursorPosition: helper.pos,
            finalCursorPosition: finalCursorPos,
            editableRegionStartLine: 0,
            editableRegionEndLine: 0,
            ...helper.options,
          };

          // When using the JetBrains extension, mark as displayed.
          // This helps us not need to make additional network calls just to mark as displayed.
          const ideType = (await this.ide.getIdeInfo()).ideType;
          if (ideType === "jetbrains") {
            this.markDisplayed(input.completionId, outcomeNext);
          }

          return outcomeNext;
        } else {
          return undefined;
        }
      } else {
        const msg: ChatMessage = await llm.chat(prompts, token);

        if (typeof msg.content === "string") {
          // NOTE: There are cases where msg.conetnt.split("<|start|>")[1] is undefined
          const nextCompletion = msg.content.split(`${CODE_TO_EDIT_OPEN}\n`)[1]
            ? replaceEscapedCharacters(
                msg.content.split(`${CODE_TO_EDIT_OPEN}\n`)[1],
              ).replace(/\n$/, "")
            : "";

          const currCursorPos = helper.pos;

          const editableRegionStartLine = Math.max(
            currCursorPos.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
            0,
          );

          const editableRegionEndLine = Math.min(
            currCursorPos.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
            helper.fileLines.length - 1,
          );

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

          const outcomeNext: NextEditOutcome = {
            elapsed: Date.now() - startTime,
            modelProvider: llm.underlyingProviderName,
            modelName: llm.model + ":zetaDataset",
            completionOptions: null,
            completionId: helper.input.completionId,
            gitRepo: await this.ide.getRepoName(helper.filepath),
            uniqueId: await this.ide.getUniqueId(),
            timestamp: Date.now(),
            fileUri: helper.filepath,
            workspaceDirUri:
              helper.workspaceUris[0] ?? path.dirname(helper.filepath),
            prompt: this.promptMetadata!.prompt.content,
            userEdits: this.promptMetadata!.userEdits,
            userExcerpts: this.promptMetadata!.userExcerpts,
            originalEditableRange: oldEditRangeSlice,
            completion: nextCompletion,
            cursorPosition: helper.pos,
            finalCursorPosition: finalCursorPos,
            editableRegionStartLine,
            editableRegionEndLine,
            ...helper.options,
          };

          this.previousCompletions.push(outcomeNext);

          // When using the JetBrains extension, mark as displayed.
          // This helps us not need to make additional network calls just to mark as displayed.
          const ideType = (await this.ide.getIdeInfo()).ideType;
          if (ideType === "jetbrains") {
            this.markDisplayed(input.completionId, outcomeNext);
          }

          return outcomeNext;
        } else {
          return undefined;
        }
      }
    } catch (e: any) {
      this.onError(e);
    } finally {
      this.loggingService.deleteAbortController(input.completionId);
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
    token: AbortSignal | undefined,
  ) {
    try {
      const previousOutcome = this.getPreviousCompletion();
      if (!previousOutcome) {
        return undefined;
      }

      const filepath = localPathOrUriToPath(previousOutcome.fileUri);

      // If we don't have a precomputed list of next editable regions already, compute and load it.
      if (this.nextEditableRegionsInTheCurrentChain.length === 0) {
        this.loadNextEditableRegionsInTheCurrentChain(
          (await getNextEditableRegion(EditableRegionStrategy.Static, {
            cursorPosition: previousOutcome.cursorPosition,
            filepath,
            ide: this.ide,
          })) ?? [],
        );

        if (this.nextEditableRegionsInTheCurrentChain.length === 0) {
          console.log(
            "deleteChain called from provideInlineCompletionItemsWithChain",
          );
          await this.deleteChain();
          return undefined;
        }
      }

      // Use the frontmost RangeInFile to build an input.
      const input = await this.buildAutocompleteInputFromChain(
        previousOutcome,
        this.nextEditableRegionsInTheCurrentChain[0], // this will be shifted after debouncer check
        ctx,
      );
      if (!input) {
        return undefined;
      }

      return await this.provideInlineCompletionItems(input, token, {
        withChain: true,
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

  public loadNextEditableRegionsInTheCurrentChain(regions: RangeInFile[]) {
    this.nextEditableRegionsInTheCurrentChain = regions;
  }

  public shiftNextEditableRegionsInTheCurrentChain() {
    return this.nextEditableRegionsInTheCurrentChain.shift();
  }

  public getNextEditableRegionsInTheCurrentChainLength() {
    return this.nextEditableRegionsInTheCurrentChain.length;
  }

  public getNextEditableRegionsInTheCurrentChain(): RangeInFile[] {
    return [...this.nextEditableRegionsInTheCurrentChain]; // Return a copy to prevent external modification
  }
}
