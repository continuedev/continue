import path from "path";
import { pathToFileURL } from "url";
import Parser from "web-tree-sitter";
import { FileType, IDE, Position } from "../../../";
import { localPathOrUriToPath } from "../../../util/pathToUri";
import { getFullLanguageName, getQueryForFile } from "../../../util/treeSitter";
import {
  AutocompleteSnippetType,
  AutocompleteStaticSnippet,
} from "../../snippets/types";
import { getAst } from "../../util/ast";
import { HelperVars } from "../../util/HelperVars";
import {
  extractFunctionTypeFromDecl,
  extractTopLevelDecls,
  findEnclosingTypeDeclaration,
  unwrapToBaseType,
} from "./tree-sitter-utils";
import {
  HoleContext,
  RelevantHeaders,
  RelevantTypes,
  StaticContext,
  TypeSpanAndSourceFile,
  TypeSpanAndSourceFileAndAst,
} from "./types";

export class StaticContextService {
  private readonly ide: IDE;

  constructor(ide: IDE) {
    this.ide = ide;
  }

  public logAutocompleteStaticSnippet(
    ctx: StaticContext,
    label = "Static Snippet",
  ) {
    console.log(`=== ${label} ===`);
    console.log("Hole Type:", ctx.holeType);

    console.log(`\nRelevant Types (${ctx.relevantTypes.size} files):`);
    ctx.relevantTypes.forEach((types, filepath) => {
      console.log(`  📁 ${filepath}`);
      types.forEach((type) => console.log(`    • ${type}`));
    });

    console.log(`\nRelevant Headers (${ctx.relevantHeaders.size} files):`);
    ctx.relevantHeaders.forEach((headers, filepath) => {
      console.log(`  📁 ${filepath}`);
      headers.forEach((header) => console.log(`    • ${header}`));
    });
  }

  public static formatAutocompleteStaticSnippet(ctx: StaticContext): string {
    let output = `AutocompleteStaticSnippet:\n`;
    output += `  holeType: ${ctx.holeType}\n`;

    output += `  relevantTypes:\n`;
    if (ctx.relevantTypes.size === 0) {
      output += `    (none)\n`;
    } else {
      ctx.relevantTypes.forEach((types, filepath) => {
        output += `    ${filepath}: [${types.join(", ")}]\n`;
      });
    }

    output += `  relevantHeaders:\n`;
    if (ctx.relevantHeaders.size === 0) {
      output += `    (none)\n`;
    } else {
      ctx.relevantHeaders.forEach((headers, filepath) => {
        output += `    ${filepath}: [${headers.join(", ")}]\n`;
      });
    }

    return output;
  }

  public async getContext(
    helper: HelperVars,
  ): Promise<AutocompleteStaticSnippet[]> {
    const start = Date.now();
    const tsFiles = await this.getTypeScriptFilesFromWorkspaces(
      helper.workspaceUris,
    );
    // Get the three contexts holeContext, relevantTypes, relevantHeaders.
    const holeContext = await this.getHoleContext(
      helper.fileContents,
      helper.filepath,
      helper.pos,
    );

    const relevantTypes = await this.extractRelevantTypes(
      holeContext.fullHoverResult,
      holeContext.functionName,
      holeContext.range.start.line,
      holeContext.source,
      new Map<string, string>(),
    );

    // if (this.language === "typescript") {
    //   repo = getAllTSFiles(this.repoPath);
    // } else if (this.language === "ocaml") {
    //   repo = getAllOCamlFiles(this.repoPath);
    // }
    //

    const relevantHeaders = await this.extractRelevantHeaders(
      tsFiles,
      relevantTypes,
      holeContext.functionTypeSpan,
      helper.pos,
      holeContext.returnTypeIsAny,
    );

    const relevantTypesToReturn: Map<string, string[]> = new Map<
      string,
      string[]
    >();
    relevantTypes.forEach(({ typeSpan: v, sourceFile: src }, _) => {
      if (relevantTypesToReturn.has(src)) {
        const updated = relevantTypesToReturn.get(src)!;
        updated.push(v);
        relevantTypesToReturn.set(src, updated);
      } else {
        relevantTypesToReturn.set(src, [v]);
      }
    });

    const relevantHeadersToReturn: Map<string, string[]> = new Map<
      string,
      string[]
    >();
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
    });

    const ctx = {
      holeType: holeContext.functionTypeSpan,
      relevantTypes: relevantTypesToReturn,
      relevantHeaders: relevantHeadersToReturn,
    };
    const end = Date.now();

    this.logAutocompleteStaticSnippet(ctx);

    // console.log(end - start);

    const snippets: AutocompleteStaticSnippet[] = [];

    snippets.push({
      type: AutocompleteSnippetType.Static,
      filepath: pathToFileURL(path.resolve(holeContext.source)).toString(),
      content: holeContext.fullHoverResult,
    });

    for (const [filepath, typs] of ctx.relevantTypes.entries()) {
      snippets.push({
        type: AutocompleteSnippetType.Static,
        filepath: pathToFileURL(path.resolve(filepath)).toString(),
        content: typs.join("\n"),
      });
    }

    for (const [filepath, headers] of ctx.relevantHeaders.entries()) {
      snippets.push({
        type: AutocompleteSnippetType.Static,
        filepath: pathToFileURL(path.resolve(filepath)).toString(),
        content: headers.join("\n"),
      });
    }

    return snippets;
  }

  private async getHoleContext(
    sketchFileContent: string,
    sketchFilePath: string,
    cursorPosition: Position,
  ): Promise<HoleContext> {
    // We need to inject the hole @ to trigger a treesitter error node.
    sketchFilePath = localPathOrUriToPath(sketchFilePath);
    // const sketchFileContent = await fs.readFile(sketchFilePath, "utf8");
    const injectedContent = this.insertAtPosition(
      sketchFileContent,
      cursorPosition,
      "@;",
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
      `static-context-queries/hole-queries/${language}.scm`,
    );
    if (!query) {
      throw new Error(
        `getHoleContext: failed to get query for file ${sketchFilePath} and language ${language}`,
      );
    }

    const captures = query.captures(ast.rootNode);
    const res: HoleContext = {
      fullHoverResult: "",
      functionName: "",
      functionTypeSpan: "",
      returnTypeIsAny: false,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      source: `file://${sketchFilePath}`,
    };
    let paramsTypes = "";
    for (const c of captures) {
      const { name, node } = c;
      // console.log(`${name} →`, node.text, node.startPosition, node.endPosition);

      switch (name) {
        case "function.decl": {
          res.fullHoverResult = node.text;
          break;
        }
        case "function.name": {
          res.functionName = node.text;
          break;
        }
        case "function.params": {
          paramsTypes = node.text;
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
          break;
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
          break;
        }
      }
    }

    if (res.functionTypeSpan === "") {
      res.functionTypeSpan = `${paramsTypes} => any`;
      res.returnTypeIsAny = true;
    }

    return res;
  }

  private async extractRelevantTypes(
    declText: string,
    typeName: string,
    startLine: number,
    currentFile: string,
    foundContents: Map<string, string>, // uri -> contents
  ): Promise<RelevantTypes> {
    const foundSoFar = new Map<string, TypeSpanAndSourceFileAndAst>(); // identifier -> [full hover result, source]

    await this.extractRelevantTypesHelper(
      declText,
      typeName,
      startLine,
      foundSoFar,
      currentFile,
      foundContents,
    );

    return foundSoFar;
  }

  private async extractRelevantTypesHelper(
    declText: string,
    typeName: string,
    startLine: number,
    foundSoFar: Map<string, TypeSpanAndSourceFileAndAst>, // identifier -> [full hover result, source]
    currentFile: string,
    foundContents: Map<string, string>, // uri -> contents
  ) {
    if (!foundSoFar.has(typeName)) {
      const ast = await getAst(currentFile, declText);
      if (!ast) {
        throw new Error(`failed to get ast for file ${currentFile}`);
      }
      foundSoFar.set(typeName, {
        typeSpan: declText,
        sourceFile: currentFile.slice(7),
        ast: ast,
      });

      const language = getFullLanguageName(currentFile);
      const query = await getQueryForFile(
        currentFile,
        `static-context-queries/relevant-types-queries/${language}-extract-identifiers.scm`,
      );
      if (!query) {
        throw new Error(
          `failed to get query for file ${currentFile} and language ${language}`,
        );
      }

      const identifiers = query.captures(ast.rootNode);

      for (const { name, node } of identifiers) {
        if (foundSoFar.has(node.text)) continue;

        try {
          const typeDefinitionResult = await this.ide.gotoTypeDefinition({
            filepath: currentFile,
            position: {
              character: node.startPosition.column,
              line: startLine + node.startPosition.row,
            },
          });

          if (typeDefinitionResult.length > 0) {
            const tdLocation = typeDefinitionResult[0];

            let content = "";

            if (foundContents.has(tdLocation.filepath)) {
              content = foundContents.get(tdLocation.filepath)!;
            } else {
              content = await this.ide.readFile(tdLocation.filepath);
              foundContents.set(tdLocation.filepath, content);
            }

            const ast = await getAst(tdLocation.filepath, content);
            if (!ast) {
              throw new Error(
                `failed to get ast for file ${tdLocation.filepath}`,
              );
            }
            const decl = findEnclosingTypeDeclaration(
              content,
              tdLocation.range.start.line,
              tdLocation.range.start.character,
              ast,
            );
            if (!decl) {
              // throw new Error(`failed to get decl for file ${tdLocation.uri}`);
              console.error(
                `failed to get decl for file ${tdLocation.filepath}`,
              );
            }

            if (decl) {
              await this.extractRelevantTypesHelper(
                decl.fullText,
                node.text,
                tdLocation.range.start.line,
                foundSoFar,
                tdLocation.filepath,
                foundContents,
              );
            } else {
              // console.log("decl not found");
            }
          } else {
            // console.log("td not found");
          }
        } catch (err) {
          console.log(err);
        }
      }
    }
  }

  private async extractRelevantHeaders(
    sources: string[],
    relevantTypes: Map<string, TypeSpanAndSourceFileAndAst>,
    holeType: string,
    cursorPosition: Position,
    returnTypeIsAny: boolean,
  ): Promise<RelevantHeaders> {
    const relevantContext = new Set<TypeSpanAndSourceFile>();
    if (returnTypeIsAny) return relevantContext;
    // NOTE: This is necessary because TypeScript sucks.
    // There is no way to compare objects by value,
    // so sets of objects starts to accumulate tons of duplicates.
    const relevantContextMap = new Map<string, TypeSpanAndSourceFile>();
    const foundNormalForms = new Map<string, string>();

    const targetTypes = await this.generateTargetTypes(relevantTypes, holeType);

    for (const source of sources) {
      const topLevelDecls = await extractTopLevelDecls(source);
      for (const tld of topLevelDecls) {
        // pattern 0 is let/const, 1 is var, 2 is fun
        // if (!seenDecls.has(JSON.stringify()) {
        const originalDeclText =
          tld.pattern === 2
            ? tld.captures.find((d) => d.name === "top.fn.decl")!.node.text
            : tld.captures.find((d) => d.name === "top.var.decl")!.node.text;

        if (tld.pattern === 2) {
          // build a type span
          // TODO: this fails sometimes with Cannot read properties of undefined (reading 'text')
          // most likely due to my scm query and how I'm not attaching param name along with param type
          let funcType = "";
          try {
            funcType = extractFunctionTypeFromDecl(tld);
          } catch (err) {
            // Most likely is the case that there is no explicit return type annotation.
            const sigHelp = await this.ide.getSignatureHelp({
              filepath: source,
              position: cursorPosition,
            });
            if (!sigHelp) continue;
            funcType = sigHelp.signatures[0].label;

            // TODO: This only works for TypeScript.
            function convertToArrowType(signature: string): string {
              // Handle various function declaration formats.
              const patterns = [
                // Standard: functionName(params): returnType.
                /^(\w+)\s*\((.*?)\)\s*:\s*(.+)$/,
                // With generics: functionName<T>(params): returnType.
                /^(\w+)\s*<[^>]*>\s*\((.*?)\)\s*:\s*(.+)$/,
                // With modifiers: export function functionName(params): returnType.
                /^(?:export\s+)?(?:function\s+)?(\w+)\s*\((.*?)\)\s*:\s*(.+)$/,
              ];

              for (const pattern of patterns) {
                const match = signature.match(pattern);
                if (match) {
                  const [, , parameters, returnType] = match;
                  return `(${parameters}) => ${returnType}`;
                }
              }

              return signature;
            }

            funcType = convertToArrowType(funcType);
          }
          const wrapped = `type __TMP = ${funcType};`;

          const ast = await getAst("file.ts", wrapped);
          if (!ast) {
            throw new Error(`failed to generate ast for ${wrapped}`);
          }

          // console.log(ast.rootNode);
          const alias = ast.rootNode.namedChild(0);
          // console.log(alias);
          if (!alias || alias.type !== "type_alias_declaration") {
            throw new Error(
              "extractRelevantHeaders: Failed to parse type alias",
            );
          }

          const valueNode = alias.childForFieldName("value");
          if (!valueNode) throw new Error("No type value found");

          const baseNode = unwrapToBaseType(valueNode);

          await this.extractRelevantHeadersHelper(
            originalDeclText,
            baseNode,
            targetTypes,
            relevantTypes,
            relevantContext,
            relevantContextMap,
            foundNormalForms,
            source,
          );
        } else {
          const varTypNode = tld.captures.find(
            (d) => d.name === "top.var.type",
          )!.node;
          await this.extractRelevantHeadersHelper(
            originalDeclText,
            varTypNode,
            targetTypes,
            relevantTypes,
            relevantContext,
            relevantContextMap,
            foundNormalForms,
            source,
          );
        }
      }
    }

    for (const v of relevantContextMap.values()) {
      relevantContext.add(v);
    }

    return relevantContext;
  }

  private async extractRelevantHeadersHelper(
    originalDeclText: string,
    node: Parser.SyntaxNode,
    targetTypes: Set<Parser.SyntaxNode>,
    relevantTypes: Map<string, TypeSpanAndSourceFileAndAst>,
    relevantContext: Set<TypeSpanAndSourceFile>,
    relevantContextMap: Map<string, TypeSpanAndSourceFile>,
    foundNormalForms: Map<string, string>,
    source: string,
  ) {
    for (const typ of targetTypes) {
      if (
        await this.isTypeEquivalent(node, typ, relevantTypes, foundNormalForms)
      ) {
        const ctx = { typeSpan: originalDeclText, sourceFile: source };
        relevantContextMap.set(JSON.stringify(ctx), ctx);
      }

      if (node.type === "function_type") {
        const retTypeNode = node.namedChildren.find(
          (c) => c && c.type === "return_type",
        );
        if (retTypeNode) {
          await this.extractRelevantHeadersHelper(
            originalDeclText,
            retTypeNode,
            targetTypes,
            relevantTypes,
            relevantContext,
            relevantContextMap,
            foundNormalForms,
            source,
          );
        }
      } else if (node.type === "tuple_type") {
        for (const c of node.namedChildren) {
          await this.extractRelevantHeadersHelper(
            originalDeclText,
            c!,
            targetTypes,
            relevantTypes,
            relevantContext,
            relevantContextMap,
            foundNormalForms,
            source,
          );
        }
      }
    }
  }

  private async generateTargetTypes(
    relevantTypes: Map<string, TypeSpanAndSourceFileAndAst>,
    holeType: string,
  ) {
    const targetTypes = new Set<Parser.SyntaxNode>();
    // const ast = relevantTypes.get(holeIdentifier)!.ast;
    const ast = await getAst("file.ts", `type T = ${holeType};`);
    if (!ast) {
      throw new Error(`failed to generate ast for ${holeType}`);
    }

    const alias = ast.rootNode.namedChild(0);
    if (!alias || alias.type !== "type_alias_declaration") {
      throw new Error("generateTargetTypes: Failed to parse type alias");
    }

    const valueNode = alias.childForFieldName("value");
    if (!valueNode) throw new Error("No type value found");

    const baseNode = unwrapToBaseType(valueNode);
    targetTypes.add(baseNode);
    await this.generateTargetTypesHelper(
      relevantTypes,
      holeType,
      targetTypes,
      baseNode,
    );

    return targetTypes;
  }

  private async generateTargetTypesHelper(
    relevantTypes: Map<string, TypeSpanAndSourceFileAndAst>,
    currType: string,
    targetTypes: Set<Parser.SyntaxNode>,
    node: Parser.SyntaxNode | null,
  ): Promise<void> {
    if (!node) return;

    if (node.type === "function_type") {
      const returnType = node.childForFieldName("return_type");
      if (returnType) {
        targetTypes.add(returnType);
        await this.generateTargetTypesHelper(
          relevantTypes,
          currType,
          targetTypes,
          returnType,
        );
      }
    }

    if (node.type === "tuple_type") {
      for (const child of node.namedChildren) {
        if (child) {
          targetTypes.add(child);
          await this.generateTargetTypesHelper(
            relevantTypes,
            currType,
            targetTypes,
            child,
          );
        }
      }
    }

    if (relevantTypes.has(node.text)) {
      // const ast = relevantTypes.get(node.text)!.ast;
      const typeSpan = relevantTypes.get(node.text)?.typeSpan;

      // const ast = await getAst("file.ts", `type T = ${typeSpan}`);
      const ast = await getAst("file.ts", typeSpan!);
      if (!ast) {
        throw new Error(`failed to generate ast for ${typeSpan}`);
      }

      const alias = ast.rootNode.namedChild(0);
      if (!alias || alias.type !== "type_alias_declaration") {
        console.error("generateTargetTypesHelper: Failed to parse type alias");
        return;
        // throw new Error(
        //   "generateTargetTypesHelper: Failed to parse type alias",
        // );
      }

      const valueNode = alias.childForFieldName("value");
      if (!valueNode) throw new Error("No type value found");

      const baseNode = unwrapToBaseType(valueNode);
      await this.generateTargetTypesHelper(
        relevantTypes,
        currType,
        targetTypes,
        baseNode,
      );
    }

    // if (node.type === "type_identifier" || node.type === "predefined_type") {
    //   return [node.text];
    // }

    return;
  }

  private async isTypeEquivalent(
    node: Parser.SyntaxNode,
    typ: Parser.SyntaxNode,
    relevantTypes: Map<string, TypeSpanAndSourceFileAndAst>,
    foundNormalForms: Map<string, string>,
  ): Promise<boolean> {
    if (!node || !typ) {
      return false;
    }
    let normT1 = "";
    let normT2 = "";
    if (foundNormalForms.has(node.text)) {
      // console.log("found t1", true)
      normT1 = foundNormalForms.get(node.text)!;
    } else {
      // console.log("not found t1", false)
      normT1 = await this.normalize(node, relevantTypes);
      foundNormalForms.set(node.text, normT1);
    }
    if (foundNormalForms.has(typ.text)) {
      // console.log("found t2", true)
      normT2 = foundNormalForms.get(typ.text)!;
    } else {
      // console.log("not found t2", false)
      normT2 = await this.normalize(typ, relevantTypes);
      foundNormalForms.set(typ.text, normT2);
    }
    // const normT1 = foundNormalForms.has(t1) ? foundNormalForms.get(t1) : this.normalize2(t1, relevantTypes);
    // const normT2 = foundNormalForms.has(t2) ? foundNormalForms.get(t2) : this.normalize2(t2, relevantTypes);
    // console.log(`normal forms: ${normT1} {}{} ${normT2}`)
    return normT1 === normT2;
  }

  private async normalize(
    node: Parser.SyntaxNode,
    relevantTypes: Map<string, TypeSpanAndSourceFileAndAst>,
  ): Promise<string> {
    if (!node) return "";

    switch (node.type) {
      case "function_type": {
        const params = node.child(0); // formal_parameters
        const returnType =
          node.childForFieldName("type") || node.namedChildren[1]; // function_type → parameters, =>, return

        const paramTypes =
          params?.namedChildren
            .map((param) =>
              this.normalize(
                param!.childForFieldName("type")! ||
                  param!.namedChildren.at(-1),
                relevantTypes,
              ),
            )
            .join(", ") || "";

        const ret = this.normalize(returnType!, relevantTypes);
        return `(${paramTypes}) => ${ret}`;
      }

      case "tuple_type": {
        const elements = node.namedChildren.map((c) =>
          this.normalize(c!, relevantTypes),
        );
        return `[${elements.join(", ")}]`;
      }

      case "union_type": {
        const parts = node.namedChildren.map((c) =>
          this.normalize(c!, relevantTypes),
        );
        return parts.join(" | ");
      }

      case "type_identifier": {
        const alias = relevantTypes.get(node.text);
        if (!alias) return node.text;

        // Parse the alias's type span
        const wrapped = `type __TMP = ${alias};`;
        const tree = await getAst("file.ts", wrapped);
        const valueNode = tree!.rootNode
          .descendantsOfType("type_alias_declaration")[0]
          ?.childForFieldName("value");

        return this.normalize(valueNode!, relevantTypes);
      }

      case "predefined_type":
      case "number":
      case "string":
        return node.text;

      default:
        // Fallback for types like array, etc.
        return node.text;
    }
  }

  private insertAtPosition = (
    contents: string,
    cursorPosition: { line: number; character: number },
    insertText: string,
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
    lines[line] =
      targetLine.slice(0, character) + insertText + targetLine.slice(character);

    return lines.join("\n"); // Reconstruct the file
  };

  private async getTypeScriptFilesFromWorkspaces(
    workspaceUris: string[],
  ): Promise<string[]> {
    const tsExtensions = [".ts"];
    const allTsFiles: string[] = [];

    for (const workspaceUri of workspaceUris) {
      try {
        // Convert URI to file path
        const folderPath = workspaceUri.startsWith("file://")
          ? new URL(workspaceUri).pathname
          : workspaceUri;

        const tsFiles = await this.scanDirectoryForTypeScriptFiles(
          folderPath,
          tsExtensions,
        );
        allTsFiles.push(...tsFiles);
      } catch (error) {
        console.error(`Error scanning workspace ${workspaceUri}:`, error);
      }
    }

    return allTsFiles;
  }

  private async scanDirectoryForTypeScriptFiles(
    dirPath: string,
    tsExtensions: string[],
  ): Promise<string[]> {
    const tsFiles: string[] = [];

    const shouldSkipDirectory = (dirName: string): boolean => {
      const skipDirs = [
        "node_modules",
        ".git",
        ".vscode",
        "dist",
        "build",
        "out",
        ".next",
        "coverage",
        ".nyc_output",
        "tmp",
        "temp",
        ".cache",
      ];

      return skipDirs.includes(dirName) || dirName.startsWith(".");
    };

    const scanRecursively = async (currentPath: string): Promise<void> => {
      try {
        const currentUri = pathToFileURL(currentPath).toString();
        const entries = await this.ide.listDir(currentUri);
        for (const [name, fileType] of entries) {
          const fullPath = localPathOrUriToPath(path.join(currentPath, name));

          if (fileType === (2 as FileType.Directory)) {
            if (!shouldSkipDirectory(name)) {
              await scanRecursively(fullPath);
            }
          } else if (fileType === (1 as FileType.File)) {
            const extension = path.extname(name).toLowerCase();
            if (tsExtensions.includes(extension)) {
              tsFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error);
      }
    };

    await scanRecursively(dirPath);
    return tsFiles;
  }
}
