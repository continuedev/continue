import { IDE } from "../..";
import { HelperVars } from "../util/HelperVars";
import { RecentlyEditedRange } from "../util/types";

import { ImportDefinitionsService } from "./ImportDefinitionsService";
import { AutocompleteSnippet, getSymbolsForSnippet } from "./ranking";
import { RootPathContextService } from "./root-path-context/RootPathContextService";

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

  public async retrieveCandidateSnippets(
    helper: HelperVars,
    extraSnippets: AutocompleteSnippet[],
  ) {
    if (helper.options.useOtherFiles === false) {
      return [];
    }

    let snippets: AutocompleteSnippet[] = [];

    // Snippets injected by the IDE for IDE-specific reasons
    snippets.push(...extraSnippets);

    // If a recently edited range has a line that is a perfect match with the start of the current line
    snippets.push(...this.getSnippetsFromRecentlyEditedRanges(helper));

    // Import definitions of any symbols in near range of the caret
    snippets.push(...(await this.getSnippetsFromImportDefinitions(helper)));

    // Root path context https://blog.continue.dev/root-path-context-the-secret-ingredient-in-continues-autocomplete-prompt/
    if (helper.options.useRootPathContext && helper.treePath) {
      snippets.push(
        ...(await this.rootPathContextService.getContextForPath(
          helper.filepath,
          helper.treePath,
        )),
      );
    }

    return snippets;
  }

  private getSnippetsFromRecentlyEditedRanges(
    helper: HelperVars,
  ): AutocompleteSnippet[] {
    if (helper.options.useRecentlyEdited === false) {
      return [];
    }

    const currentLinePrefix = helper.prunedPrefix
      .trim()
      .split("\n")
      .slice(-1)[0];
    if (
      currentLinePrefix?.length > helper.options.recentLinePrefixMatchMinLength
    ) {
      const matchingRange = this.findMatchingRange(
        helper.input.recentlyEditedRanges,
        currentLinePrefix,
      );

      if (matchingRange) {
        return [
          {
            ...matchingRange,
            contents: matchingRange.lines.join("\n"),
            score: 0.8,
          },
        ];
      }
    }

    return [];
  }

  private async getSnippetsFromImportDefinitions(
    helper: HelperVars,
  ): Promise<AutocompleteSnippet[]> {
    if (helper.options.useImports === false) {
      return [];
    }

    const importSnippets = [];
    const fileInfo = this.importDefinitionsService.get(helper.filepath);
    if (fileInfo) {
      const { imports } = fileInfo;
      // Look for imports of any symbols around the current range
      const textAroundCursor =
        helper.fullPrefix.split("\n").slice(-5).join("\n") +
        helper.fullSuffix.split("\n").slice(0, 3).join("\n");
      const symbols = Array.from(getSymbolsForSnippet(textAroundCursor)).filter(
        (symbol) => !helper.lang.topLevelKeywords.includes(symbol),
      );
      for (const symbol of symbols) {
        const rifs = imports[symbol];
        if (Array.isArray(rifs)) {
          importSnippets.push(...rifs);
        }
      }
    }
    return importSnippets;
  }

  findMatchingRange(
    recentlyEditedRanges: RecentlyEditedRange[],
    linePrefix: string,
  ): RecentlyEditedRange | undefined {
    return recentlyEditedRanges.find((recentlyEditedRange) => {
      return recentlyEditedRange.lines.some((line) =>
        line.startsWith(linePrefix),
      );
    });
  }
}
