import fs from "node:fs";
import * as path from "node:path";

import Parser, { Language } from "web-tree-sitter";

import { FileSymbolMap, IDE, SymbolWithRange } from "..";

export const supportedLanguages: { [key: string]: string } = {
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hxx: "cpp",
  cp: "cpp",
  hh: "cpp",
  inc: "cpp",
  // Depended on this PR: https://github.com/tree-sitter/tree-sitter-cpp/pull/173
  // ccm: "cpp",
  // c++m: "cpp",
  // cppm: "cpp",
  // cxxm: "cpp",
  cs: "c_sharp",
  c: "c",
  h: "c",
  css: "css",
  php: "php",
  phtml: "php",
  php3: "php",
  php4: "php",
  php5: "php",
  php7: "php",
  phps: "php",
  "php-s": "php",
  bash: "bash",
  sh: "bash",
  json: "json",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  // vue: "vue",  // tree-sitter-vue parser is broken
  // The .wasm file being used is faulty, and yaml is split line-by-line anyway for the most part
  // yaml: "yaml",
  // yml: "yaml",
  elm: "elm",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  ipynb: "python",
  pyw: "python",
  pyi: "python",
  el: "elisp",
  emacs: "elisp",
  ex: "elixir",
  exs: "elixir",
  go: "go",
  eex: "embedded_template",
  heex: "embedded_template",
  leex: "embedded_template",
  html: "html",
  htm: "html",
  java: "java",
  lua: "lua",
  ocaml: "ocaml",
  ml: "ocaml",
  mli: "ocaml",
  ql: "ql",
  res: "rescript",
  resi: "rescript",
  rb: "ruby",
  erb: "ruby",
  rs: "rust",
  rdl: "systemrdl",
  toml: "toml",
  sol: "solidity",

  // jl: "julia",
  // swift: "swift",
  // kt: "kotlin",
  // scala: "scala",
};

export async function getParserForFile(filepath: string) {
  try {
    await Parser.init();
    const parser = new Parser();

    const language = await getLanguageForFile(filepath);
    if (!language) {
      return undefined;
    }

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
  try {
    await Parser.init();
    const extension = path.extname(filepath).slice(1);

    const languageName = supportedLanguages[extension];
    if (!languageName) {
      return undefined;
    }
    let language = nameToLanguage.get(languageName);

    if (!language) {
      language = await loadLanguageForFileExt(extension);
      nameToLanguage.set(languageName, language);
    }
    return language;
  } catch (e) {
    console.debug("Unable to load language for file", filepath, e);
    return undefined;
  }
}

export enum TSQueryType {
  CodeSnippets = "code-snippet-queries",
  Imports = "import-queries",
  // Used in RootPathContextService.ts
  FunctionDeclaration = "root-path-context-queries/function_declaration",
  MethodDefinition = "root-path-context-queries/method_definition",
  FunctionDefinition = "root-path-context-queries/function_definition",
  MethodDeclaration = "root-path-context-queries/method_declaration",
}

export async function getQueryForFile(
  filepath: string,
  queryPath: string,
): Promise<Parser.Query | undefined> {
  const language = await getLanguageForFile(filepath);
  if (!language) {
    return undefined;
  }

  const fullLangName = supportedLanguages[filepath.split(".").pop() ?? ""];
  const sourcePath = path.join(
    __dirname,
    "..",
    ...(process.env.NODE_ENV === "test"
      ? ["extensions", "vscode", "tree-sitter"]
      : ["tree-sitter"]),
    queryPath,
    `${fullLangName}.scm`,
  );
  if (!fs.existsSync(sourcePath)) {
    return undefined;
  }
  const querySource = fs.readFileSync(sourcePath).toString();

  const query = language.query(querySource);
  return query;
}

async function loadLanguageForFileExt(
  fileExtension: string,
): Promise<Language> {
  const wasmPath = path.join(
    __dirname,
    ...(process.env.NODE_ENV === "test"
      ? ["node_modules", "tree-sitter-wasms", "out"]
      : ["tree-sitter-wasms"]),
    `tree-sitter-${supportedLanguages[fileExtension]}.wasm`,
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

  const tree = parser.parse(contents);
  console.log(`file: ${filepath}`);

  // Function to recursively find all named nodes (classes and functions)
  const symbols: SymbolWithRange[] = [];
  function findNamedNodesRecursive(node: Parser.SyntaxNode) {
    // console.log(`node: ${node.type}, ${node.text}`);
    if (GET_SYMBOLS_FOR_NODE_TYPES.includes(node.type)) {
      // console.log(`parent: ${node.type}, ${node.text.substring(0, 200)}`);
      // node.children.forEach((child) => {
      //   console.log(`child: ${child.type}, ${child.text}`);
      // });

      // Empirically, the actualy name is the last identifier in the node
      // Especially with languages where return type is declared before the name
      // TODO use findLast in newer version of node target
      let identifier: Parser.SyntaxNode | undefined = undefined;
      for (let i = node.children.length - 1; i >= 0; i--) {
        if (node.children[i].type === "identifier") {
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

export async function getSymbolsForFiles(
  uris: string[],
  ide: IDE,
): Promise<FileSymbolMap> {
  const filesAndSymbols = await Promise.all(
    uris.map(async (uri): Promise<[string, SymbolWithRange[]]> => {
      const contents = await ide.readFile(uri);
      const symbols = await getSymbolsForFile(uri, contents);
      return [uri, symbols ?? []];
    }),
  );
  return Object.fromEntries(filesAndSymbols);
}
