import { IDE } from "../../index";
import { findUriInDirs } from "../../util/uri";
import { ContextRetrievalService } from "../context/ContextRetrievalService";
import { GetLspDefinitionsFunction } from "../types";
import { HelperVars } from "../util/HelperVars";

import {
  AutocompleteClipboardSnippet,
  AutocompleteCodeSnippet,
  AutocompleteDiffSnippet,
  AutocompleteSnippetType,
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
}

function racePromise<T>(promise: Promise<T[]>): Promise<T[]> {
  const timeoutPromise = new Promise<T[]>((resolve) => {
    setTimeout(() => resolve([]), 100);
  });

  return Promise.race([promise, timeoutPromise]);
}

class DiffSnippetsCache {
  private cache: Map<number, any> = new Map();
  private lastTimestamp: number = 0;

  public set<T>(timestamp: number, value: T): T {
    // Clear old cache entry if exists
    if (this.lastTimestamp !== timestamp) {
      this.cache.clear();
    }
    this.lastTimestamp = timestamp;
    this.cache.set(timestamp, value);
    return value;
  }

  public get(timestamp: number): any | undefined {
    return this.cache.get(timestamp);
  }
}

const diffSnippetsCache = new DiffSnippetsCache();

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
  const currentTimestamp = ide.getLastFileSaveTimestamp ?
    ide.getLastFileSaveTimestamp() :
    Math.floor(Date.now() / 10000) * 10000; // Defaults to update once in every 10 seconds

  // Check cache first
  const cached = diffSnippetsCache.get(currentTimestamp) as AutocompleteDiffSnippet[];

  if (cached) {
    return cached;
  }

  let diff: string[] = [];
  try {
    diff = await ide.getDiff(true);
  } catch (e) {
    console.error("Error getting diff for autocomplete", e);
  }

  return diffSnippetsCache.set(currentTimestamp, diff.map((item) => {
    return {
      content: item,
      type: AutocompleteSnippetType.Diff,
    };
  }));

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
  ] = await Promise.all([
    racePromise(contextRetrievalService.getRootPathSnippets(helper)),
    racePromise(contextRetrievalService.getSnippetsFromImportDefinitions(helper)),
    IDE_SNIPPETS_ENABLED ? racePromise(getIdeSnippets(helper, ide, getDefinitionsFromLsp)) : [],
    racePromise(getDiffSnippets(ide)),
    racePromise(getClipboardSnippets(ide)),
  ]);

  return {
    rootPathSnippets,
    importDefinitionSnippets,
    ideSnippets,
    recentlyEditedRangeSnippets,
    diffSnippets,
    clipboardSnippets,
    recentlyVisitedRangesSnippets: helper.input.recentlyVisitedRanges,
  };
};
