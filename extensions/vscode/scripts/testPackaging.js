// This script verifies after pacakging that necessary files are in the correct locations
// In many cases just taking a sample file from the folder when they are all roughly the same thing
const fs = require("fs");

let target = undefined;
const args = process.argv;
if (args[2] === "--target") {
  target = args[3];
}

if (!target) {
  const os = {
    aix: "linux",
    darwin: "darwin",
    freebsd: "linux",
    linux: "linux",
    openbsd: "linux",
    sunos: "linux",
    win32: "win32",
  }[process.platform];
  const arch = {
    arm: "arm64",
    arm64: "arm64",
    ia32: "x64",
    loong64: "arm64",
    mips: "arm64",
    mipsel: "arm64",
    ppc: "x64",
    ppc64: "x64",
    riscv64: "arm64",
    s390: "x64",
    s390x: "x64",
    x64: "x64",
  }[process.arch];

  target = `${os}-${arch}`;
  console.log("[info] Detected target: ", target);
}

const [os, arch] = target.split("-");
const exe = os === "win32" ? ".exe" : "";

const pathsToVerify = [
  // Queries used to create the index for @code context provider
  "tree-sitter/code-snippet-queries/tree-sitter-c_sharp-tags.scm",

  // Queries used for @outline and @highlights context providers
  "tag-qry/tree-sitter-c_sharp-tags.scm",

  // onnx runtime bindngs
  `bin/napi-v3/${os}/${arch}/onnxruntime_binding.node`,
  `bin/napi-v3/${os}/${arch}/libonnxruntime.1.14.0.dylib`,
  "builtin-themes/dark_modern.json",

  // Code/styling for the sidebar
  "gui/assets/index.js",
  "gui/assets/index.css",

  // Tutorial
  "media/welcome.md",
  "continue_tutorial.py",
  "config_schema.json",

  // Embeddings model
  "models/all-MiniLM-L6-v2/config.json",
  "models/all-MiniLM-L6-v2/special_tokens_map.json",
  "models/all-MiniLM-L6-v2/tokenizer_config.json",
  "models/all-MiniLM-L6-v2/tokenizer.json",
  "models/all-MiniLM-L6-v2/vocab.txt",
  "models/all-MiniLM-L6-v2/onnx/model_quantized.onnx",

  // node_modules (it's a bit confusing why this is necessary)
  `node_modules/@vscode/ripgrep/bin/rg${exe}`,

  // out directory (where the extension.js lives)
  "out/extension.js",
  // web-tree-sitter
  "out/tree-sitter.wasm",
  // Worker required by jsdom
  "out/xhr-sync-worker.js",
  // SQLite3 Node native module
  "out/build/Release/node_sqlite3.node",

  // out/node_modules (to be accessed by extension.js)
  `out/node_modules/@vscode/ripgrep/bin/rg${exe}`,
  `out/node_modules/@esbuild/${target}/bin/esbuild${exe}`,
  `out/node_modules/@lancedb/vectordb-${target}/index.node`,
  `out/node_modules/esbuild/lib/main.js`,
  `out/node_modules/esbuild/bin/esbuild${exe}`,
];

for (const path of pathsToVerify) {
  if (!fs.existsSync(path)) {
    throw new Error(`File ${path} does not exist`);
  }
}

console.log("All paths exist");
