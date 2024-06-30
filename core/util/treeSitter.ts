import fs from "node:fs";
import path from "node:path";
import Parser, { Language } from "web-tree-sitter";

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
  vue: "vue",
  // The .wasm file being used is faulty, and yaml is split line-by-line anyway for the most part
  // yaml: "yaml",
  // yml: "yaml",
  elm: "elm",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
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
    parser.setLanguage(language);

    return parser;
  } catch (e) {
    console.error("Unable to load language for file", filepath, e);
    return undefined;
  }
}

export async function getLanguageForFile(
  filepath: string,
): Promise<Language | undefined> {
  try {
    await Parser.init();
    const extension = path.extname(filepath).slice(1);

    if (!supportedLanguages[extension]) {
      return undefined;
    }

    const wasmPath = path.join(
      __dirname,
      "tree-sitter-wasms",
      `tree-sitter-${supportedLanguages[extension]}.wasm`,
    );
    const language = await Parser.Language.load(wasmPath);
    return language;
  } catch (e) {
    console.error("Unable to load language for file", filepath, e);
    return undefined;
  }
}

export enum TSQueryType {
  CodeSnippets = "code-snippet-queries",
  Imports = "import-queries",
  // Used in HierarchicalContextService.ts
  FunctionDeclaration = "hierarchical-context-queries/function_declaration",
  MethodDefinition = "hierarchical-context-queries/method_definition",
  FunctionDefinition = "hierarchical-context-queries/function_definition",
  MethodDeclaration = "hierarchical-context-queries/method_declaration",
}

export async function getQueryForFile(
  filepath: string,
  queryType: TSQueryType,
): Promise<Parser.Query | undefined> {
  const language = await getLanguageForFile(filepath);
  if (!language) {
    return undefined;
  }

  const fullLangName = supportedLanguages[filepath.split(".").pop() ?? ""];
  const sourcePath = path.join(
    __dirname,
    "..",
    "tree-sitter",
    queryType,
    `${fullLangName}.scm`,
  );
  if (!fs.existsSync(sourcePath)) {
    return undefined;
  }
  const querySource = fs.readFileSync(sourcePath).toString();

  const query = language.query(querySource);
  return query;
}
