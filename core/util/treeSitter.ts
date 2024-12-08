import fs from "node:fs";
import * as path from "node:path";

import Parser, { Language } from "web-tree-sitter";
import { FileSymbolMap, IDE, SymbolWithRange } from "..";
import { languageForFilepath, LanguageId } from "./languageId";
import { getUserTreeSitterFolderPath } from "./paths";

export const supportedLanguages: { [key in LanguageId]?: string } = {
  [LanguageId.CSharp]: "c_sharp",
  [LanguageId.C]: "c",
  [LanguageId.CSS]: "css",
  [LanguageId.PHP]: "php",
  [LanguageId.Bash]: "bash",
  [LanguageId.Json]: "json",
  [LanguageId.Typescript]: "typescript",
  [LanguageId.Tsx]: "tsx",
  [LanguageId.Elm]: "elm",
  [LanguageId.Javascript]: "javascript",
  [LanguageId.Python]: "python",
  [LanguageId.Elisp]: "elisp",
  [LanguageId.Elixir]: "elixir",
  [LanguageId.Go]: "go",
  [LanguageId.EmbeddedTemplate]: "embedded_template",
  [LanguageId.Html]: "html",
  [LanguageId.Java]: "java",
  [LanguageId.Lua]: "lua",
  [LanguageId.Ocaml]: "ocaml",
  [LanguageId.Ql]: "ql",
  [LanguageId.Rescript]: "rescript",
  [LanguageId.Ruby]: "ruby",
  [LanguageId.Rust]: "rust",
  [LanguageId.Systemrdl]: "systemrdl",
  [LanguageId.Toml]: "toml",
  [LanguageId.Solidity]: "solidity",
};

export const IGNORE_PATH_PATTERNS: Partial<Record<LanguageId, RegExp[]>> = {
  [LanguageId.Typescript]: [/.*node_modules/],
  [LanguageId.Javascript]: [/.*node_modules/],
};

export async function getParserForFile(filepath: string) {
  try {
    await Parser.init();

    const language = await getLanguageForFile(filepath);
    if (!language) {
      return undefined;
    }

    const parser = new Parser();
    parser.setLanguage(language);

    return parser;
  } catch (e) {
    console.debug("Unable to load language for file", filepath, e);
    return undefined;
  }
}

// Loading the wasm files to create a Language object is an expensive operation and with
// sufficient number of files can result in errors, instead keep a map of language name
// to Language object
const nameToLanguage = new Map<string, Language>();

export async function getLanguageForFile(
  filepath: string,
): Promise<Language | undefined> {
  return getLanguage(languageForFilepath(filepath));
}

export async function getLanguage(
  languageId: LanguageId,
): Promise<Language | undefined> {
  try {
    if (supportedLanguages[languageId] === undefined) {
      return undefined;
    }
    await Parser.init();
    let language = nameToLanguage.get(languageId);

    if (!language) {
      language = await loadLanguage(languageId);
      nameToLanguage.set(languageId, language);
    }
    return language;
  } catch (e) {
    console.debug("Unable to load tree sitter language for ", languageId, e);
    return undefined;
  }
}

export async function getQuery(
  languageId: LanguageId,
  prefix: string,
  suffix: string,
): Promise<Parser.Query | undefined> {
  const language = await getLanguage(languageId);
  if (!language) {
    return undefined;
  }

  const defaultPath = path.join(
    __dirname,
    "..",
    ...(process.env.NODE_ENV === "test"
      ? ["extensions", "vscode", "tree-sitter"]
      : ["tree-sitter"]),
  );

  const userPath = getUserTreeSitterFolderPath();

  const subPath = path.join(prefix, languageId, suffix + ".scm");

  let filePath = path.join(userPath, subPath);
  if (!fs.existsSync(filePath)) filePath = path.join(defaultPath, subPath);
  if (!fs.existsSync(filePath)) return undefined;

  const querySource = (await fs.promises.readFile(filePath)).toString();
  return language.query(querySource);
}

export async function getQueryForFile(
  filepath: string,
  queryPath: string,
): Promise<Parser.Query | undefined> {
  const language = await getLanguageForFile(filepath);
  if (!language) {
    return undefined;
  }

  const sourcePath = path.join(
    __dirname,
    "..",
    ...(process.env.NODE_ENV === "test"
      ? ["extensions", "vscode", "tree-sitter"]
      : ["tree-sitter"]),
    queryPath,
  );
  if (!fs.existsSync(sourcePath)) {
    return undefined;
  }
  const querySource = fs.readFileSync(sourcePath).toString();

  const query = language.query(querySource);
  return query;
}

async function loadLanguage(id: LanguageId): Promise<Language> {
  const wasmPath = path.join(
    __dirname,
    ...(process.env.NODE_ENV === "test"
      ? ["node_modules", "tree-sitter-wasms", "out"]
      : ["tree-sitter-wasms"]),
    `tree-sitter-${supportedLanguages[id]}.wasm`,
  );
  return await Parser.Language.load(wasmPath);
}

// See https://tree-sitter.github.io/tree-sitter/using-parsers
const GET_SYMBOLS_FOR_NODE_TYPES: Parser.SyntaxNode["type"][] = [
  "class_declaration",
  "class_definition",
  "function_item", // function name = first "identifier" child
  "function_definition",
  "method_declaration", // method name = first "identifier" child
  "method_definition",
  "generator_function_declaration",
  // property_identifier
  // field_declaration
  // "arrow_function",
];

export async function getSymbolsForFile(
  filepath: string,
  contents: string,
): Promise<SymbolWithRange[] | undefined> {
  const parser = await getParserForFile(filepath);

  if (!parser) {
    return;
  }

  let tree: Parser.Tree;
  try {
    tree = parser.parse(contents);
  } catch (e) {
    console.log(`Error parsing file: ${filepath}`);
    return;
  }
  // console.log(`file: ${filepath}`);

  // Function to recursively find all named nodes (classes and functions)
  const symbols: SymbolWithRange[] = [];
  function findNamedNodesRecursive(node: Parser.SyntaxNode) {
    // console.log(`node: ${node.type}, ${node.text}`);
    if (GET_SYMBOLS_FOR_NODE_TYPES.includes(node.type)) {
      // console.log(`parent: ${node.type}, ${node.text.substring(0, 200)}`);
      // node.children.forEach((child) => {
      //   console.log(`child: ${child.type}, ${child.text}`);
      // });

      // Empirically, the actual name is the last identifier in the node
      // Especially with languages where return type is declared before the name
      // TODO use findLast in newer version of node target
      let identifier: Parser.SyntaxNode | undefined = undefined;
      for (let i = node.children.length - 1; i >= 0; i--) {
        if (
          node.children[i].type === "identifier" ||
          node.children[i].type === "property_identifier"
        ) {
          identifier = node.children[i];
          break;
        }
      }

      if (identifier?.text) {
        symbols.push({
          filepath,
          type: node.type,
          name: identifier.text,
          range: {
            start: {
              character: node.startPosition.column,
              line: node.startPosition.row,
            },
            end: {
              character: node.endPosition.column + 1,
              line: node.endPosition.row + 1,
            },
          },
        });
      }
    }
    node.children.forEach(findNamedNodesRecursive);
  }
  findNamedNodesRecursive(tree.rootNode);

  return symbols;
}

export async function getSymbolsForManyFiles(
  uris: string[],
  ide: IDE,
): Promise<FileSymbolMap> {
  const filesAndSymbols = await Promise.all(
    uris.map(async (uri): Promise<[string, SymbolWithRange[]]> => {
      const contents = await ide.readFile(uri);
      let symbols = undefined;
      try {
        symbols = await getSymbolsForFile(uri, contents);
      } catch (e) {
        console.error(`Failed to get symbols for ${uri}:`, e);
      }
      return [uri, symbols ?? []];
    }),
  );
  return Object.fromEntries(filesAndSymbols);
}

export function treeToString(
  node: Parser.SyntaxNode,
  indent: string = "",
): string {
  let result = "";
  result += `${indent}${node.type} ${rangeToString(node)} {\n`;
  node.namedChildren.forEach((child) => {
    result += treeToString(child, indent + "  ") + "\n";
  });
  result += indent + `}`;
  return result;
}

export function positionToString(position: Parser.Point): string {
  return `${position.row + 1}:${position.column + 1}`;
}

export function rangeToString(range: Parser.Range): string {
  return `${positionToString(range.startPosition)} - ${positionToString(
    range.endPosition,
  )}`;
}
