import { createHash } from "crypto";
import { LRUCache } from "lru-cache";
import Parser from "web-tree-sitter";
import { IDE } from "../..";
import { getQueryForFile, TSQueryType } from "../../util/treeSitter";
import { AstPath } from "../ast";
import { AutocompleteSnippet } from "../ranking";
import { ImportDefinitionsService } from "./ImportDefinitionsService";

export class HierarchicalContextService {
  private cache = new LRUCache<string, AutocompleteSnippet[]>({
    max: 100,
  });

  constructor(
    private readonly importDefinitionsService: ImportDefinitionsService,
    private readonly ide: IDE,
  ) {}

  private static getNodeId(node: Parser.SyntaxNode): string {
    return `${node.startIndex}`;
  }

  private static TYPES_TO_USE = new Set([
    "program",
    "function_declaration",
    "method_definition",
  ]);

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
      .update(HierarchicalContextService.getNodeId(astNode))
      .digest("hex");
  }

  private async getSnippetsForNode(
    filepath: string,
    node: Parser.SyntaxNode,
  ): Promise<AutocompleteSnippet[]> {
    const snippets: AutocompleteSnippet[] = [];

    let query: Parser.Query | undefined;
    switch (node.type) {
      case "program":
        this.importDefinitionsService.get(filepath);
        break;
      case "function_declaration":
        query = await getQueryForFile(
          filepath,
          TSQueryType.FunctionDeclaration,
        );
        break;
      case "method_definition":
        query = await getQueryForFile(filepath, TSQueryType.MethodDefinition);
        break;
      default:
        break;
    }

    if (!query) {
      return snippets;
    }

    await Promise.all(
      query.matches(node).map(async (match) => {
        const startPosition = match.captures[0].node.startPosition;
        const endPosition = match.captures[0].node.endPosition;
        const definitions = await this.ide.gotoDefinition({
          filepath,
          position: {
            line: endPosition.row,
            character: endPosition.column,
          },
        });
        const newSnippets = await Promise.all(
          definitions.map(async (def) => ({
            ...def,
            contents: await this.ide.readRangeInFile(def.filepath, def.range),
          })),
        );
        snippets.push(...newSnippets);
      }),
    );

    return snippets;
  }

  async getContextForPath(
    filepath: string,
    astPath: AstPath,
    // cursorIndex: number,
  ): Promise<AutocompleteSnippet[]> {
    const snippets: AutocompleteSnippet[] = [];

    let parentKey = filepath;
    for (const astNode of astPath.filter((node) =>
      HierarchicalContextService.TYPES_TO_USE.has(node.type),
    )) {
      const key = HierarchicalContextService.keyFromNode(parentKey, astNode);

      const foundInCache = this.cache.get(key);
      const newSnippets =
        foundInCache ?? (await this.getSnippetsForNode(filepath, astNode));
      snippets.push(...newSnippets);

      if (!foundInCache) {
        this.cache.set(key, newSnippets);
      }

      parentKey = key;
    }

    return snippets;
  }
}
