import { IDE } from "../../index";
import { ContextRetrievalService } from "../context/ContextRetrievalService";
import { AutocompleteContext } from "../util/AutocompleteContext";
import {
  filterSnippetsAlreadyInCaretWindow,
  keepSnippetsFittingInMaxTokens,
} from "./filtering";
import {
  AutocompleteClipboardSnippet,
  AutocompleteCodeSnippet,
  AutocompleteDiffSnippet,
  AutocompleteSnippet,
  AutocompleteSnippetType,
} from "./types";

export interface SnippetPayload {
  rootPathSnippets: AutocompleteCodeSnippet[];
  importDefinitionSnippets: AutocompleteCodeSnippet[];
  recentlyEditedRangeSnippets: AutocompleteCodeSnippet[];
  diffSnippets: AutocompleteDiffSnippet[];
  clipboardSnippets: AutocompleteClipboardSnippet[];
}

function getSnippetsFromRecentlyEditedRanges(
  helper: AutocompleteContext,
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
  ctx: AutocompleteContext,
): Promise<AutocompleteClipboardSnippet[]> => {
  const content = await ide.getClipboardContent();

  if (ctx.options.logClipboardSnippets) {
    await ctx.writeLog(`ClipboardSnippets: received ${content.text}`);
  }

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
  ctx: AutocompleteContext,
): Promise<AutocompleteDiffSnippet[]> => {
  const diff = await ide.getDiff(true);
  if (ctx.options.logDiffSnippets) {
    await ctx.writeLog(`DiffSnippets: received\n${diff.join("\n\n")}\n----\n`);
  }

  return diff.map((item) => {
    return {
      content: item,
      type: AutocompleteSnippetType.Diff,
    };
  });
};

export const getAllSnippets = async (
  ctx: AutocompleteContext,
  ide: IDE,
  contextRetrievalService: ContextRetrievalService,
): Promise<AutocompleteSnippet[]> => {
  async function racePromise<T>(
    promise: Promise<T[]>,
    name: string,
  ): Promise<T[]> {
    const timeoutPromise = new Promise<T[]>((resolve) => {
      setTimeout(() => resolve([]), 100);
    });

    const result = await Promise.race([
      promise.then((t) => [t, "data"] as const),
      timeoutPromise.then((t) => [t, "timeout"] as const),
    ]);

    if (ctx.options.logSnippetTimeouts && result[1] === "timeout") {
      ctx.writeLog(`Snippet ${name} timed out`);
    }

    return result[0];
  }

  const recentlyEditedRangeSnippets = getSnippetsFromRecentlyEditedRanges(ctx);

  const empty = Promise.resolve([]);

  const snippets: AutocompleteSnippet[][] = [
    recentlyEditedRangeSnippets,
    ...(await Promise.all([
      ctx.langOptions.enableRootPathSnippets
        ? racePromise(
            contextRetrievalService.getRootPathSnippets(ctx),
            "rootPath",
          )
        : empty,
      ctx.langOptions.enableImportSnippets
        ? racePromise(
            contextRetrievalService.getSnippetsFromImportDefinitions(ctx),
            "imports",
          )
        : empty,
      ctx.langOptions.enableDiffSnippets
        ? racePromise(getDiffSnippets(ide, ctx), "diffs")
        : empty,
      ctx.langOptions.enableClipboardSnippets
        ? racePromise(getClipboardSnippets(ide, ctx), "clipboardSnippets")
        : empty,
    ])),
  ];

  return keepSnippetsFittingInMaxTokens(
    ctx,
    filterSnippetsAlreadyInCaretWindow(snippets.flat(), ctx.prunedCaretWindow),
  );
};
