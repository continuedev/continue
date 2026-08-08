import { IDE } from "../../index";
import { findUriInDirs } from "../../util/uri";
import { ContextRetrievalService } from "../context/ContextRetrievalService";
import { GetLspDefinitionsFunction } from "../types";
import { HelperVars } from "../util/HelperVars";
import { openedFilesLruCache } from "../util/openedFilesLruCache";
import { getDiffsFromCache } from "./gitDiffCache";

import {
  AutocompleteClipboardSnippet,
  AutocompleteCodeSnippet,
  AutocompleteDiffSnippet,
  AutocompleteSnippetType,
  AutocompleteStaticSnippet,
} from "./types";

const IDE_SNIPPETS_ENABLED = false; // ideSnippets is not used, so it's temporarily disabled

export interface SnippetPayload {
  rootPathSnippets: AutocompleteCodeSnippet[];
  importDefinitionSnippets: AutocompleteCodeSnippet[];
  ideSnippets: AutocompleteCodeSnippet[];
  recentlyEditedRangeSnippets: AutocompleteCodeSnippet[];
  recentlyVisitedRangesSnippets: AutocompleteCodeSnippet[];
  diffSnippets: AutocompleteDiffSnippet[];
  clipboardSnippets: AutocompleteClipboardSnippet[];
  recentlyOpenedFileSnippets: AutocompleteCodeSnippet[];
  staticSnippet: AutocompleteStaticSnippet[];
}

function racePromise<T>(promise: Promise<T[]>, timeout = 100): Promise<T[]> {
  const timeoutPromise = new Promise<T[]>((resolve) => {
    setTimeout(() => resolve([]), timeout);
  });

  return Promise.race([promise, timeoutPromise]);
}

// Some IDEs might have special ways of finding snippets (e.g. JetBrains and VS Code have different "LSP-equivalent" systems,
// or they might separately track recently edited ranges)
async function getIdeSnippets(
  helper: HelperVars,
  ide: IDE,
  getDefinitionsFromLsp: GetLspDefinitionsFunction,
): Promise<AutocompleteCodeSnippet[]> {
  const ideSnippets = await getDefinitionsFromLsp(
    helper.input.filepath,
    helper.fullPrefix + helper.fullSuffix,
    helper.fullPrefix.length,
    ide,
    helper.lang,
  );

  if (helper.options.onlyMyCode) {
    const workspaceDirs = await ide.getWorkspaceDirs();

    return ideSnippets.filter((snippet) =>
      workspaceDirs.some(
        (dir) => !!findUriInDirs(snippet.filepath, [dir]).foundInDir,
      ),
    );
  }

  return ideSnippets;
}

function getSnippetsFromRecentlyEditedRanges(
  helper: HelperVars,
): AutocompleteCodeSnippet[] {
  if (helper.options.useRecentlyEdited === false) {
    return [];
  }

  return helper.input.recentlyEditedRanges.map((range) => {
    return {
      filepath: range.filepath,
      content: range.lines.join("\n"),
      type: AutocompleteSnippetType.Code,
    };
  });
}

const getClipboardSnippets = async (
  ide: IDE,
): Promise<AutocompleteClipboardSnippet[]> => {
  const content = await ide.getClipboardContent();

  return [content].map((item) => {
    return {
      content: item.text,
      copiedAt: item.copiedAt,
      type: AutocompleteSnippetType.Clipboard,
    };
  });
};

const getDiffSnippets = async (
  ide: IDE,
): Promise<AutocompleteDiffSnippet[]> => {
  const diffs = await getDiffsFromCache(ide);

  return diffs.map((item) => {
    return {
      content: item,
      type: AutocompleteSnippetType.Diff,
    };
  });
};

const getSnippetsFromRecentlyOpenedFiles = async (
  helper: HelperVars,
  ide: IDE,
): Promise<AutocompleteCodeSnippet[]> => {
  if (helper.options.useRecentlyOpened === false) {
    return [];
  }

  try {
    const currentFileUri = `${helper.filepath}`;

    // Get all file URIs excluding the current file
    const fileUrisToRead = [...openedFilesLruCache.entriesDescending()]
      .filter(([fileUri, _]) => fileUri !== currentFileUri)
      .map(([fileUri, _]) => fileUri);

    // Create an array of promises that each read a file with timeout
    const fileReadPromises = fileUrisToRead.map((fileUri) => {
      // Create a promise that resolves to a snippet or null
      const readPromise = new Promise<AutocompleteCodeSnippet | null>(
        (resolve) => {
          ide
            .readFile(fileUri)
            .then((fileContent) => {
              if (!fileContent || fileContent.trim() === "") {
                resolve(null);
                return;
              }

              resolve({
                filepath: fileUri,
                content: fileContent,
                type: AutocompleteSnippetType.Code,
              });
            })
            .catch((e) => {
              console.error(`Failed to read file ${fileUri}:`, e);
              resolve(null);
            });
        },
      );
      // Cut off at 80ms via racing promises
      return Promise.race([
        readPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 80)),
      ]);
    });

    // Execute all file reads in parallel
    const results = await Promise.all(fileReadPromises);

    // Filter out null results
    return results.filter(Boolean) as AutocompleteCodeSnippet[];
  } catch (e) {
    console.error("Error processing opened files cache:", e);
    return [];
  }
};

export const getAllSnippets = async ({
  helper,
  ide,
  getDefinitionsFromLsp,
  contextRetrievalService,
}: {
  helper: HelperVars;
  ide: IDE;
  getDefinitionsFromLsp: GetLspDefinitionsFunction;
  contextRetrievalService: ContextRetrievalService;
}): Promise<SnippetPayload> => {
  const recentlyEditedRangeSnippets =
    getSnippetsFromRecentlyEditedRanges(helper);

  const [
    rootPathSnippets,
    importDefinitionSnippets,
    ideSnippets,
    diffSnippets,
    clipboardSnippets,
    recentlyOpenedFileSnippets,
    staticSnippet,
  ] = await Promise.all([
    racePromise(contextRetrievalService.getRootPathSnippets(helper)),
    racePromise(
      contextRetrievalService.getSnippetsFromImportDefinitions(helper),
    ),
    IDE_SNIPPETS_ENABLED
      ? racePromise(getIdeSnippets(helper, ide, getDefinitionsFromLsp))
      : [],
    [], // racePromise(getDiffSnippets(ide)) // temporarily disabled, see https://github.com/continuedev/continue/pull/5882,
    racePromise(getClipboardSnippets(ide)),
    racePromise(getSnippetsFromRecentlyOpenedFiles(helper, ide)), // giving this one a little more time to complete
    helper.options.experimental_enableStaticContextualization
      ? racePromise(contextRetrievalService.getStaticContextSnippets(helper))
      : [],
  ]);

  return {
    rootPathSnippets,
    importDefinitionSnippets,
    ideSnippets,
    recentlyEditedRangeSnippets,
    diffSnippets,
    clipboardSnippets,
    recentlyVisitedRangesSnippets: helper.input.recentlyVisitedRanges,
    recentlyOpenedFileSnippets,
    staticSnippet,
  };
};

export const getAllSnippetsWithoutRace = async ({
  helper,
  ide,
  getDefinitionsFromLsp,
  contextRetrievalService,
}: {
  helper: HelperVars;
  ide: IDE;
  getDefinitionsFromLsp: GetLspDefinitionsFunction;
  contextRetrievalService: ContextRetrievalService;
}): Promise<SnippetPayload> => {
  const recentlyEditedRangeSnippets =
    getSnippetsFromRecentlyEditedRanges(helper);

  const [
    rootPathSnippets,
    importDefinitionSnippets,
    ideSnippets,
    diffSnippets,
    clipboardSnippets,
    recentlyOpenedFileSnippets,
    staticSnippet,
  ] = await Promise.all([
    contextRetrievalService.getRootPathSnippets(helper),
    contextRetrievalService.getSnippetsFromImportDefinitions(helper),
    IDE_SNIPPETS_ENABLED
      ? getIdeSnippets(helper, ide, getDefinitionsFromLsp)
      : [],
    [], // racePromise(getDiffSnippets(ide)) // temporarily disabled, see https://github.com/continuedev/continue/pull/5882,
    getClipboardSnippets(ide),
    getSnippetsFromRecentlyOpenedFiles(helper, ide),
    helper.options.experimental_enableStaticContextualization
      ? contextRetrievalService.getStaticContextSnippets(helper)
      : [],
  ]);

  return {
    rootPathSnippets,
    importDefinitionSnippets,
    ideSnippets,
    recentlyEditedRangeSnippets,
    diffSnippets,
    clipboardSnippets,
    recentlyVisitedRangesSnippets: helper.input.recentlyVisitedRanges,
    recentlyOpenedFileSnippets,
    staticSnippet,
  };
};
