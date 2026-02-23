import { Position } from "../..";
import { ContextRetrievalService } from "../../autocomplete/context/ContextRetrievalService";
import { getAllSnippetsWithoutRace } from "../../autocomplete/snippets/getAllSnippets";
import { AutocompleteCodeSnippet } from "../../autocomplete/snippets/types";
import { renderPrompt } from "../../autocomplete/templating";
import { GetLspDefinitionsFunction } from "../../autocomplete/types";
import { HelperVars } from "../../autocomplete/util/HelperVars";
import {
  AutocompleteInput,
  RecentlyEditedRange,
} from "../../autocomplete/util/types";
import { ConfigHandler } from "../../config/ConfigHandler";
import { IDE, ILLM } from "../../index";
import { isSecurityConcern } from "../../indexing/ignore";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../../util/parameters";

/**
 * Gets the formatted autocomplete context string that would be used for autocomplete at the given position.
 * This function mimics the context generation pipeline from the autocomplete system without triggering
 * an actual completion.
 *
 * @param filepath - The file path where context is being requested
 * @param pos - The position in the file where context is being requested
 * @param ide - The IDE interface for file system operations
 * @param configHandler - The config handler to load user configuration
 * @param getDefinitionsFromLsp - Function to get LSP definitions (can be a no-op function if not needed)
 * @param autocompleteModel - Optional autocomplete model to use (if not provided, uses configured autocomplete model)
 * @param recentlyEditedRanges - Recently edited ranges (defaults to empty array)
 * @param recentlyVisitedRanges - Recently visited ranges (if not provided, will fetch current live data like real autocomplete)
 * @param maxPromptTokens - Optional override for maximum number of tokens (if not provided, uses config)
 * @param manuallyPassFileContents - Optional file contents to use instead of reading from disk (should match current editor state)
 * @returns Promise that resolves to the formatted context string
 */
export const getAutocompleteContext = async (
  filepath: string,
  pos: Position,
  ide: IDE,
  configHandler: ConfigHandler,
  getDefinitionsFromLsp: GetLspDefinitionsFunction = async () => [],
  recentlyEditedRanges: RecentlyEditedRange[],
  recentlyVisitedRanges: AutocompleteCodeSnippet[],
  maxPromptTokens: number,
  manuallyPassFileContents: string,
  autocompleteModel?: ILLM | string,
  // eslint-disable-next-line max-params
): Promise<string> => {
  if (!recentlyEditedRanges) recentlyEditedRanges = [];
  if (!recentlyVisitedRanges) recentlyVisitedRanges = [];

  const input: AutocompleteInput = {
    isUntitledFile: false,
    completionId: `context-fetch-${Date.now()}`,
    filepath,
    pos,
    recentlyVisitedRanges,
    recentlyEditedRanges,
    manuallyPassFileContents,
  };

  const { config } = await configHandler.loadConfig();
  if (!config) {
    throw new Error("No config available");
  }

  if (isSecurityConcern(input.filepath)) {
    throw new Error("File is a security concern, autocomplete disabled");
  }

  // Use provided autocomplete model or fall back to configured autocomplete model
  let finalModel: ILLM;
  let modelNameForTemplating: string;

  if (autocompleteModel) {
    if (typeof autocompleteModel === "string") {
      // Try to find the model in config first
      const foundModel = config.modelsByRole.autocomplete.find(
        (m) => m.title === autocompleteModel,
      );
      if (foundModel) {
        finalModel = foundModel;
        modelNameForTemplating = foundModel.model;
      } else {
        // Model not found in config, but we can still use it for template selection
        const configuredModel = config.selectedModelByRole.autocomplete;
        if (!configuredModel) {
          throw new Error(
            "No autocomplete model configured and provided model not found in config",
          );
        }
        finalModel = configuredModel;
        modelNameForTemplating = autocompleteModel; // Use the provided string for template selection
      }
    } else {
      finalModel = autocompleteModel;
      modelNameForTemplating = autocompleteModel.model;
    }
  } else {
    const configuredModel = config.selectedModelByRole.autocomplete;
    if (!configuredModel) {
      throw new Error("No autocomplete model configured and no model provided");
    }
    finalModel = configuredModel;
    modelNameForTemplating = configuredModel.model;
  }

  const options = {
    ...DEFAULT_AUTOCOMPLETE_OPTS,
    ...config.tabAutocompleteOptions,
    ...finalModel.autocompleteOptions,
    ...(maxPromptTokens && { maxPromptTokens }),
  };

  if (finalModel.promptTemplates?.autocomplete) {
    options.template = finalModel.promptTemplates.autocomplete as string;
  }

  const helper = await HelperVars.create(
    input,
    options,
    modelNameForTemplating,
    ide,
  );

  const contextRetrievalService = new ContextRetrievalService(ide);

  await contextRetrievalService.initializeForFile(filepath);

  const [snippetPayload, workspaceDirs] = await Promise.all([
    getAllSnippetsWithoutRace({
      helper,
      ide: ide,
      getDefinitionsFromLsp: getDefinitionsFromLsp,
      contextRetrievalService: contextRetrievalService,
    }),
    ide.getWorkspaceDirs(),
  ]);

  const { prompt, prefix, suffix, completionOptions } = renderPrompt({
    snippetPayload,
    workspaceDirs,
    helper,
  });

  return prefix;
};
