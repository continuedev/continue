import { IDE } from "../..";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippetType,
} from "../snippets/types";
import { AutocompleteContext } from "../util/AutocompleteContext";

import { ImportDefinitionsService } from "./ImportDefinitionsService";
import { createOutline } from "./outline/createOutline";
import { getSymbolsForSnippet } from "./ranking";
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

  public async getSnippetsFromImportDefinitions(
    ctx: AutocompleteContext,
  ): Promise<AutocompleteCodeSnippet[]> {
    if (ctx.options.useImports === false) {
      return [];
    }

    const importSnippets: AutocompleteCodeSnippet[] = [];
    const fileInfo = this.importDefinitionsService.get(ctx.filepath);
    if (fileInfo) {
      const { imports } = fileInfo;
      // Look for imports of any symbols around the current range
      const textAroundCursor =
        ctx.fullPrefix.split("\n").slice(-5).join("\n") +
        ctx.fullSuffix.split("\n").slice(0, 3).join("\n");
      const symbols = Array.from(getSymbolsForSnippet(textAroundCursor)).filter(
        (symbol) => !ctx.lang.topLevelKeywords.includes(symbol),
      );
      if (ctx.options.logImportSnippets)
        ctx.writeLog(
          `ImportDefinitionSnippets: Text around cursor:\n${textAroundCursor}\n extracted symbols: ${symbols}`,
        );
      for (const symbol of symbols) {
        const fileRanges = imports[symbol];
        if (Array.isArray(fileRanges)) {
          const snippets: AutocompleteCodeSnippet[] = await Promise.all(
            fileRanges.map(async (rif) => {
              if (ctx.options.logImportSnippets)
                ctx.writeLog(
                  `ImportDefinitionSnippets: found definition ${rif.filepath} ${rif.range.start.line}:${rif.range.start.character} - ${rif.range.end.line}:${rif.range.end.character}`,
                );

              const outline = await createOutline(
                rif.filepath,
                rif.contents,
                rif.range,
                ctx,
              );
              return {
                filepath: rif.filepath,
                content: outline ?? rif.contents,
                type: AutocompleteSnippetType.Code,
              };
            }),
          );

          importSnippets.push(...snippets);
        }
      }
    }

    return importSnippets;
  }

  public async getRootPathSnippets(
    ctx: AutocompleteContext,
  ): Promise<AutocompleteCodeSnippet[]> {
    if (!ctx.treePath) {
      return [];
    }

    return this.rootPathContextService.getContextForPath(
      ctx.filepath,
      ctx.treePath,
      ctx,
    );
  }
}
