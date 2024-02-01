// import treeSitterBash from "tree-sitter-wasms/out/tree-sitter-bash.wasm";
// import treeSitterC from "tree-sitter-wasms/out/tree-sitter-c.wasm";
// import treeSitterCSharp from "tree-sitter-wasms/out/tree-sitter-c_sharp.wasm";
// import treeSitterCpp from "tree-sitter-wasms/out/tree-sitter-cpp.wasm";
// import treeSitterCss from "tree-sitter-wasms/out/tree-sitter-css.wasm";
// // import treeSitterElisp from "tree-sitter-wasms/out/tree-sitter-elisp.wasm"
// // import treeSitterElixir from "tree-sitter-wasms/out/tree-sitter-elixir.wasm"
// import treeSitterElm from "tree-sitter-wasms/out/tree-sitter-elm.wasm";
// // import treeSitterEmbeddedTemplate from "tree-sitter-wasms/out/tree-sitter-embedded_template.wasm"
// import treeSitterGo from "tree-sitter-wasms/out/tree-sitter-go.wasm";
// import treeSitterHtml from "tree-sitter-wasms/out/tree-sitter-html.wasm";
// import treeSitterJava from "tree-sitter-wasms/out/tree-sitter-java.wasm";
// import treeSitterJavascript from "tree-sitter-wasms/out/tree-sitter-javascript.wasm";
// import treeSitterJson from "tree-sitter-wasms/out/tree-sitter-json.wasm";
// // import treeSitterLua from "tree-sitter-wasms/out/tree-sitter-lua.wasm"
// import treeSitterOcaml from "tree-sitter-wasms/out/tree-sitter-ocaml.wasm";
// import treeSitterPhp from "tree-sitter-wasms/out/tree-sitter-php.wasm";
// import treeSitterPython from "tree-sitter-wasms/out/tree-sitter-python.wasm";
// // import treeSitterQl from "tree-sitter-wasms/out/tree-sitter-ql.wasm"
// // import treeSitterRescript from "tree-sitter-wasms/out/tree-sitter-rescript.wasm"
// import treeSitterRuby from "tree-sitter-wasms/out/tree-sitter-ruby.wasm";
// import treeSitterRust from "tree-sitter-wasms/out/tree-sitter-rust.wasm";
// // import treeSitterSystemRdl from "tree-sitter-wasms/out/tree-sitter-systemrdl.wasm"
// import treeSitterToml from "tree-sitter-wasms/out/tree-sitter-toml.wasm";
// import treeSitterTsx from "tree-sitter-wasms/out/tree-sitter-tsx.wasm";
// import treeSitterTypescript from "tree-sitter-wasms/out/tree-sitter-typescript.wasm";
// import treeSitterVue from "tree-sitter-wasms/out/tree-sitter-vue.wasm";
// import treeSitterYaml from "tree-sitter-wasms/out/tree-sitter-yaml.wasm";

import Parser from "web-tree-sitter";

// export const fileExtensionToWasm: { [key: string]: string } = {
//   py: treeSitterPython,
//   js: treeSitterJavascript,
//   html: treeSitterHtml,
//   java: treeSitterJava,
//   go: treeSitterGo,
//   rb: treeSitterRuby,
//   rs: treeSitterRust,
//   c: treeSitterC,
//   cpp: treeSitterCpp,
//   cs: treeSitterCSharp,
//   php: treeSitterPhp,
//   css: treeSitterCss,
//   bash: treeSitterBash,
//   json: treeSitterJson,
//   ts: treeSitterTypescript,
//   tsx: treeSitterTsx,
//   vue: treeSitterVue,
//   yaml: treeSitterYaml,
//   toml: treeSitterToml,
//   ocaml: treeSitterOcaml,
//   elm: treeSitterElm,
//   // jl: treeSitterJulia,
//   // swift: "swift",
//   // kt: "kotlin",
//   // scala: treeSitterScala,
// };

export const supportedLanguages: { [key: string]: string } = {
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  css: "css",
  bash: "bash",
  json: "json",
  ts: "typescript",
  tsx: "tsx",
  vue: "vue",
  yaml: "yaml",
  toml: "toml",
  ocaml: "ocaml",
  elm: "elm",
  rb: "ruby",
  js: "javascript",
  // jl: "julia",
  // swift: "swift",
  // kt: "kotlin",
  // scala: "scala",
};

export async function getParserForFile(filepath: string) {
  await Parser.init();
  const parser = new Parser();
  const segs = filepath.split(".");
  const wasmPath = `${__dirname}/tree-sitter-wasms/tree-sitter-${
    supportedLanguages[segs[segs.length - 1]]
  }.wasm`;
  const Language = await Parser.Language.load(wasmPath);
  parser.setLanguage(Language);
  return parser;
}
