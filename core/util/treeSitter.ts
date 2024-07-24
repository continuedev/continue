import fs from "node:fs";
import * as path from "node:path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import Parser, { Language } from "web-tree-sitter";

function getDirname(): string {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }

  // @ts-ignore
  const __filename = fileURLToPath(import.meta.url);
  return dirname(__filename);
}

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
    console.error("Unable to load language for file", filepath, e);
    return undefined;
  }
}

export enum TSQueryType {
  CodeSnippets = "code-snippet-queries",
  Imports = "import-queries",
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
    getDirname(),
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

async function loadLanguageForFileExt(
  fileExtension: string,
): Promise<Language> {
  const dirname = getDirname();

  // When linking this module, we are running from `dist/util` directory
  const dirPathIfRunningAsLinkedModule = "dist/util";

  const pathToNodeModules = dirname.endsWith(dirPathIfRunningAsLinkedModule)
    ? "../../node_modules"
    : "node_modules";

  const wasmPath = path.join(
    getDirname(),
    ...(process.env.NODE_ENV === "test"
      ? [pathToNodeModules, "tree-sitter-wasms", "out"]
      : ["tree-sitter-wasms"]),
    `tree-sitter-${supportedLanguages[fileExtension]}.wasm`,
  );
  return await Parser.Language.load(wasmPath);
}
