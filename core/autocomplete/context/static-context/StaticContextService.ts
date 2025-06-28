import * as fs from "fs/promises";
import { IDE, Position } from "../../..";
import { AutocompleteCodeSnippet, AutocompleteStaticSnippet } from "../../snippets/types";
import { HelperVars } from "../../util/HelperVars";
import { HoleContext, RelevantHeaders, RelevantTypes } from "./types";
import { getAst } from "../../util/ast";
import { getFullLanguageName, getQueryForFile } from "../../../util/treeSitter";
import path from "path";

export class StaticContextService {
  private readonly ide: IDE;

  constructor(ide: IDE) {
    this.ide = ide;
  }

  public async getContext(
    helper: HelperVars
  ): Promise<AutocompleteStaticSnippet> {
    // Get the three contexts holeContext, relevantTypes, relevantHeaders.
    const holeContext = await this.getHoleContext(helper.filepath, helper.pos);

    const relevantTypes = await this.extractRelevantTypes(
      holeContext.fullHoverResult,
      holeContext.functionName,
      holeContext.range.start.line,
      new Map<string, TypeSpanAndSourceFileAndAst>(),
      holeContext.source,
      new Map<string, string>(),
    );

    let repo: string[] = [];
    if (this.language === "typescript") {
      repo = getAllTSFiles(this.repoPath);
    } else if (this.language === "ocaml") {
      repo = getAllOCamlFiles(this.repoPath);
    }

    const relevantHeaders = await this.extractRelevantHeaders(
      repo,
      relevantTypes,
      holeContext.functionTypeSpan,
      holeContext.functionName,
      this.repoPath
    );

    const relevantTypesToReturn: Map<string, string[]> = new Map<string, string[]>();
    relevantTypes.forEach(({ typeSpan: v, sourceFile: src }, _) => {
      if (relevantTypesToReturn.has(src)) {
        const updated = relevantTypesToReturn.get(src)!;
        updated.push(v);
        relevantTypesToReturn.set(src, updated);
      } else {
        relevantTypesToReturn.set(src, [v]);
      }
    })


    const relevantHeadersToReturn: Map<string, string[]> = new Map<string, string[]>();
    relevantHeaders.forEach(({ typeSpan: v, sourceFile: src }) => {
      if (relevantHeadersToReturn.has(src)) {
        const updated = relevantHeadersToReturn.get(src)!;
        if (!updated.includes(v)) {
          updated.push(v);
        }
        relevantHeadersToReturn.set(src, updated);
      } else {
        relevantHeadersToReturn.set(src, [v]);
      }
    })

    return {
      holeType: ""
      relevantTypes: ""
      relevantHeaders: ""
    };
  }

  private async getHoleContext(
    sketchFilePath: string,
    cursorPosition: Position
  ): Promise<HoleContext> {
    // We need to inject the hole @ to trigger a treesitter error node.
    const sketchFileContent = await fs.readFile(sketchFilePath, "utf8");
    const injectedContent = this.insertAtPosition(
      sketchFileContent,
      cursorPosition,
      "@;"
    );

    // The hole's position is cursorPosition.

    // Use treesitter to parse.
    const ast = await getAst(sketchFilePath, injectedContent);
    if (!ast) {
      throw new Error("failed to get ast");
    }
    const language = getFullLanguageName(sketchFilePath);
    const query = await getQueryForFile(
      sketchFilePath,
      path.join(`./queries/hole-queries/${language}.scm`)
    );
    if (!query) {
      throw new Error(
        `failed to get query for file ${sketchFilePath} and language ${language}`
      );
    }

    const captures = query.captures(ast.rootNode);
    const res: HoleContext = {
      fullHoverResult: "",
      functionName: "",
      functionTypeSpan: "",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 52 },
      },
      source: `file://${sketchFilePath}`,
    };
    for (const c of captures) {
      const { name, node } = c;
      // console.log(`${name} →`, node.text, node.startPosition, node.endPosition);

      switch (name) {
        case "function.decl": {
          res.fullHoverResult = node.text;
        }
        case "function.name": {
          res.functionName = node.text;
        }
        case "function.type": {
          res.functionTypeSpan = node.text;
          res.range = {
            start: {
              line: node.startPosition.row,
              character: node.startPosition.column,
            },
            end: {
              line: node.endPosition.row,
              character: node.endPosition.column,
            },
          };
        }
      }
    }

    return res;
  }

  private async extractRelevantTypes(): Promise<RelevantTypes> {

  }

  private async extractRelevantHeaders(): Promise<RelevantHeaders> {

  }


  private insertAtPosition = (
    contents: string,
    cursorPosition: { line: number, character: number },
    insertText: string
  ): string => {
    const lines = contents.split(/\r?\n/); // Handle both LF and CRLF line endings
    const { line, character } = cursorPosition;

    if (line < 0 || line >= lines.length) {
      throw new Error("Invalid line number");
    }

    const targetLine = lines[line];
    if (character < 0 || character > targetLine.length) {
      throw new Error("Invalid character index");
    }

    // Insert the text
    lines[line] = targetLine.slice(0, character) + insertText + targetLine.slice(character);

    return lines.join("\n"); // Reconstruct the file
  }
}
