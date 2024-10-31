import { IDE } from "../..";
import { HelperVars } from "../util/HelperVars";
import { RecentlyEditedRange } from "../util/types";
import { ImportDefinitionsService } from "./ImportDefinitionsService";
import { AutocompleteSnippet, getSymbolsForSnippet } from "./ranking";
import { RootPathContextService } from "./RootPathContextService";

export function findMatchingRange(
  recentlyEditedRanges: RecentlyEditedRange[],
  linePrefix: string,
): RecentlyEditedRange | undefined {
  return recentlyEditedRanges.find((recentlyEditedRange) => {
    return recentlyEditedRange.lines.some((line) =>
      line.startsWith(linePrefix),
    );
  });
}

export class ContextRetrievalService {
  private importDefinitionsService: ImportDefinitionsService;
  private rootPathContextService: RootPathContextService;

  constructor(private readonly ide: IDE) {
    this.importDefinitionsService = new ImportDefinitionsService(this.ide);
    this.rootPathContextService = new RootPathContextService(
      this.importDefinitionsService,
      this.ide,
    );
  }

  public async retrieve(
    prunedPrefix: string,
    helper: HelperVars,
    extraSnippets: AutocompleteSnippet[],
  ) {
    // Find external snippets
    let snippets: AutocompleteSnippet[] = [];

    if (helper.options.useOtherFiles) {
      snippets.push(...extraSnippets);

      if (helper.options.useRecentlyEdited) {
        const currentLinePrefix = prunedPrefix.trim().split("\n").slice(-1)[0];
        if (
          currentLinePrefix?.length >
          helper.options.recentLinePrefixMatchMinLength
        ) {
          const matchingRange = findMatchingRange(
            helper.input.recentlyEditedRanges,
            currentLinePrefix,
          );
          if (matchingRange) {
            snippets.push({
              ...matchingRange,
              contents: matchingRange.lines.join("\n"),
              score: 0.8,
            });
          }
        }
      }

      // Use imports
      if (helper.options.useImports) {
        const importSnippets = [];
        const fileInfo = this.importDefinitionsService.get(helper.filepath);
        if (fileInfo) {
          const { imports } = fileInfo;
          // Look for imports of any symbols around the current range
          const textAroundCursor =
            helper.fullPrefix.split("\n").slice(-5).join("\n") +
            helper.fullSuffix.split("\n").slice(0, 3).join("\n");
          const symbols = Array.from(
            getSymbolsForSnippet(textAroundCursor),
          ).filter((symbol) => !helper.lang.topLevelKeywords.includes(symbol));
          for (const symbol of symbols) {
            const rifs = imports[symbol];
            if (Array.isArray(rifs)) {
              importSnippets.push(...rifs);
            }
          }
        }
        snippets.push(...importSnippets);
      }

      if (helper.options.useRootPathContext && helper.treePath) {
        const ctx = await this.rootPathContextService.getContextForPath(
          helper.filepath,
          helper.treePath,
        );
        snippets.push(...ctx);
      }
    }

    return snippets;
  }
}
