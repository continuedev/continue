import { IDE } from "../../index";
import { ContextRetrievalService } from "../context/ContextRetrievalService";
import { GetLspDefinitionsFunction } from "../types";
import { HelperVars } from "../util/HelperVars";
import {
  AutocompleteClipboardSnippet,
  AutocompleteCodeSnippet,
  AutocompleteDiffSnippet,
  AutocompleteSnippetType,
} from "./types";

// Some IDEs might have special ways of finding snippets (e.g. JetBrains and VS Code have different "LSP-equivalent" systems,
// or they might separately track recently edited ranges)
async function getIdeSnippets(
  helper: HelperVars,
  ide: IDE,
  getDefinitionsFromLsp: GetLspDefinitionsFunction,
): Promise<AutocompleteCodeSnippet[]> {
  const ideSnippets = (await Promise.race([
    getDefinitionsFromLsp(
      helper.input.filepath,
      helper.fullPrefix + helper.fullSuffix,
      helper.fullPrefix.length,
      ide,
      helper.lang,
    ),
    new Promise((resolve) => {
      setTimeout(() => resolve([]), 100);
    }),
  ])) as AutocompleteCodeSnippet[];

  if (helper.options.onlyMyCode) {
    const workspaceDirs = await ide.getWorkspaceDirs();

    return ideSnippets.filter((snippet) =>
      workspaceDirs.some((dir) => snippet.filepath.startsWith(dir)),
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
      score: 0.8,
      type: AutocompleteSnippetType.Code,
    };
  });
}

export type TEMP__Snippets = {
  snippets: AutocompleteCodeSnippet[];
  diff: string | undefined;
  clipboardContent: {
    text: string;
    copiedAt: string;
  };
  new: {
    rootPathSnippets: AutocompleteCodeSnippet[];
    importDefinitionSnippets: AutocompleteCodeSnippet[];
    ideSnippets: AutocompleteCodeSnippet[];
    recentlyEditedRangeSnippets: AutocompleteCodeSnippet[];
    diffSnippets: AutocompleteDiffSnippet[];
    clipboardSnippets: AutocompleteClipboardSnippet[];
  };
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
}): Promise<TEMP__Snippets> => {
  const recentlyEditedRangeSnippets =
    getSnippetsFromRecentlyEditedRanges(helper);

  const [
    rootPathSnippets,
    importDefinitionSnippets,
    ideSnippets,
    diff,
    clipboardContent,
  ] = await Promise.all([
    contextRetrievalService.getRootPathSnippets(helper),
    contextRetrievalService.getSnippetsFromImportDefinitions(helper),
    getIdeSnippets(helper, ide, getDefinitionsFromLsp),
    ide.getDiff(true),
    ide.getClipboardContent(),
  ]);

  return {
    snippets: [
      ...rootPathSnippets,
      ...importDefinitionSnippets,
      ...ideSnippets,
      ...recentlyEditedRangeSnippets,
    ],
    diff,
    clipboardContent,
    new: {
      rootPathSnippets,
      importDefinitionSnippets,
      ideSnippets,
      recentlyEditedRangeSnippets,
      diffSnippets: [diff].map((item) => {
        return {
          content: item,
          type: AutocompleteSnippetType.Diff,
        };
      }),
      clipboardSnippets: [clipboardContent].map((item) => {
        return {
          content: item.text,
          copiedAt: item.copiedAt,
          type: AutocompleteSnippetType.Clipboard,
        };
      }),
    },
  };
};
