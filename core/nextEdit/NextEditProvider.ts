import * as path from "path";
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
import AutocompleteLruCache from "../autocomplete/util/AutocompleteLruCache.js";
import { HelperVars } from "../autocomplete/util/HelperVars.js";
import { AutocompleteInput } from "../autocomplete/util/types.js";
import { replaceEscapedCharacters } from "../util/text.js";
import {
  NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
  NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
} from "./constants.js";
import { NextEditLoggingService } from "./NextEditLoggingService.js";
import {
  renderDefaultSystemPrompt,
  renderDefaultUserPrompt,
  renderPrompt,
} from "./templating/NextEditPromptEngine.js";
import { NextEditOutcome, Prompt, PromptMetadata } from "./types.js";
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
  private loggingService: NextEditLoggingService;
  private contextRetrievalService: ContextRetrievalService;
  private endpointType: "default" | "fineTuned";
  private diffContext: string = "";
  private promptMetadata: PromptMetadata | null = null;

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

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
  ): Promise<NextEditOutcome | undefined> {
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
        const promptMetadata = renderPrompt(helper, this.diffContext);
        this.promptMetadata = promptMetadata;
        prompts.push(promptMetadata.prompt);
      }

      if (this.endpointType === "default") {
        const msg: ChatMessage = await llm.chat(prompts, token);
        if (typeof msg.content === "string") {
          const nextCompletion = JSON.parse(msg.content).newCode;
          const outcomeNext: NextEditOutcome = {
            elapsed: Date.now() - startTime,
            modelProvider: llm.underlyingProviderName,
            modelName: llm.model + ":zetaDataset",
            completionOptions: null,
            // filepath: helper.filepath,
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
          const nextCompletion = msg.content.split(
            "<|editable_region_start|>\n",
          )[1]
            ? replaceEscapedCharacters(
                msg.content.split("<|editable_region_start|>\n")[1],
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

          const outcomeNext: NextEditOutcome = {
            elapsed: Date.now() - startTime,
            modelProvider: llm.underlyingProviderName,
            modelName: llm.model + ":zetaDataset",
            completionOptions: null,
            // filepath: helper.filepath,
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
      }
    } catch (e: any) {
      this.onError(e);
    } finally {
      this.loggingService.deleteAbortController(input.completionId);
    }
  }
}
