import { createHash } from "crypto";

import Parser from "web-tree-sitter";

import { IDE } from "../../..";
import { rangeInFileToString } from "../../../util";
import { languageForFilepath, LanguageId } from "../../../util/languageId";
import {
  getQuery,
  IGNORE_PATH_PATTERNS,
  rangeToString,
} from "../../../util/treeSitter";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippetType,
} from "../../snippets/types";
import { AstPath } from "../../util/ast";
import {
  AutocompleteLoggingContext,
  LogWriter,
} from "../../util/AutocompleteContext";
import { ImportDefinitionsService } from "../ImportDefinitionsService";
import { createOutline } from "../outline/createOutline";
import { LRUAsyncCache } from "./LRUAsyncCache";

export class RootPathContextService {
  private snippetCache = new LRUAsyncCache({
    max: 100,
    ttl: 1000 * 30,
  });

  constructor(
    private readonly importDefinitionsService: ImportDefinitionsService,
    private readonly ide: IDE,
  ) {}

  private static getNodeId(node: Parser.SyntaxNode): string {
    return `${node.startIndex}`;
  }

  /**
   * Key comes from hash of parent key and node type and node id.
   */
  private static keyFromNode(
    parentKey: string,
    astNode: Parser.SyntaxNode,
  ): string {
    return createHash("sha256")
      .update(parentKey)
      .update(astNode.type)
      .update(RootPathContextService.getNodeId(astNode))
      .digest("hex");
  }

  private async getSnippetsForNode(
    filepath: string,
    node: Parser.SyntaxNode,
    ctx: AutocompleteLoggingContext,
    writeLog?: LogWriter,
  ): Promise<AutocompleteCodeSnippet[]> {
    const language = languageForFilepath(filepath);

    const query = await getQuery(
      language,
      `root-path-context-queries`,
      node.type,
    );

    if (!query) {
      writeLog?.(`No query for node type ${node.type} in language ${language}`);

      return [];
    }

    const snippets: AutocompleteCodeSnippet[] = [];
    const queries = query.matches(node).map(async (match) => {
      writeLog?.(
        `Match found: node type: ${node.type} language: ${language} patternIndex: ${match.pattern}, nodePosition: ${rangeToString(node)}`,
      );
      for (const item of match.captures) {
        writeLog?.(
          `Capture found: node type: ${item.node.type} nodePosition: ${rangeToString(item.node)} text: ${item.node.text}`,
        );

        try {
          const endPosition = item.node.endPosition;
          const newSnippets = await this.getSnippets(
            filepath,
            endPosition,
            language,
            ctx,
            writeLog,
          );
          snippets.push(...newSnippets);
        } catch (e) {
          throw e;
        }
      }
    });

    await Promise.all(queries);

    return snippets;
  }

  private async getSnippets(
    filepath: string,
    endPosition: Parser.Point,
    language: LanguageId,
    ctx: AutocompleteLoggingContext,
    writeLog?: LogWriter,
  ): Promise<AutocompleteCodeSnippet[]> {
    const definitions = await this.ide.gotoDefinition({
      filepath,
      position: {
        line: endPosition.row,
        character: endPosition.column,
      },
    });
    writeLog?.(
      "Found definitions: " +
        definitions.map((d) => rangeInFileToString(d)).join(", "),
    );
    const newSnippets: AutocompleteCodeSnippet[] = await Promise.all(
      definitions
        .filter((definition) => {
          const isIgnoredPath = IGNORE_PATH_PATTERNS[language]?.some(
            (pattern) => pattern.test(definition.filepath),
          );
          if (isIgnoredPath)
            writeLog?.(`Ignoring path: ${definition.filepath}`);
          return !isIgnoredPath;
        })
        .map(async (def) => {
          const fileContents = await this.ide.readFile(def.filepath);
          const outline = await createOutline(
            def.filepath,
            fileContents,
            def.range,
            ctx,
          );
          if (outline !== undefined) {
            writeLog?.("Created Outline for " + rangeInFileToString(def));
            return {
              type: AutocompleteSnippetType.Code,
              filepath: def.filepath,
              content: outline,
            };
          }

          writeLog?.("Created Snippet for " + rangeInFileToString(def));
          return {
            type: AutocompleteSnippetType.Code,
            filepath: def.filepath,
            content: await this.ide.readRangeInFile(def.filepath, def.range),
          };
        }),
    );

    return newSnippets;
  }

  async getContextForPath(
    filepath: string,
    astPath: AstPath,
    ctx: AutocompleteLoggingContext,
  ): Promise<AutocompleteCodeSnippet[]> {
    const snippets: AutocompleteCodeSnippet[] = [];
    const writeLog = ctx.options.logRootPathSnippets
      ? async (message: string) => ctx.writeLog(`RootPathSnippets: ${message}`)
      : undefined;

    let parentKey = filepath;
    const filteredAstPath = astPath.filter((node) => node.isNamed());

    writeLog?.(`processing path ${filteredAstPath.map((t) => t.type)}`);
    for (const astNode of filteredAstPath) {
      const key = RootPathContextService.keyFromNode(parentKey, astNode);

      const newSnippets = await this.snippetCache.get(
        key,
        () => {
          writeLog?.(`getting snippets for ${astNode.type}`);
          return this.getSnippetsForNode(filepath, astNode, ctx, writeLog);
        },
        () => {
          writeLog?.(`cache hit for ${astNode.type}`);
        },
      );

      snippets.push(...newSnippets);

      parentKey = key;
    }

    return snippets;
  }
}
