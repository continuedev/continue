/**
 * This is an experimental copy of `prepackage.js` that will attempt to build the extension in a fully cross-platform way.
 * This is not what we use for real builds.
 * It is also not complete. Current status is that it is just beginning to be refactored.
 */

const fs = require("fs");
const path = require("path");

const { rimrafSync } = require("rimraf");

const {
  validateFilesPresent,
  autodetectPlatformAndArch,
} = require("../../../scripts/util/index");

const { generateAndCopyConfigYamlSchema } = require("./generate-copy-config");
const { npmInstall } = require("./npm-install");
const {
  buildGui,
  copyOnnxRuntimeFromNodeModules,
  copyTreeSitterWasms,
  copyNodeModules,
  downloadRipgrepBinary,
  copySqliteBinary,
  installNodeModuleInTempDirAndCopyToCurrent,
  downloadSqliteBinary,
  copyTokenizers,
  copyScripts,
} = require("./utils");

// Clear folders that will be packaged to ensure clean slate
rimrafSync(path.join(__dirname, "..", "bin"));
rimrafSync(path.join(__dirname, "..", "out"));
fs.mkdirSync(path.join(__dirname, "..", "out", "node_modules"), {
  recursive: true,
});
const guiDist = path.join(__dirname, "..", "..", "..", "gui", "dist");
if (!fs.existsSync(guiDist)) {
  fs.mkdirSync(guiDist, { recursive: true });
}

// Get the target to package for
let target = undefined;
const args = process.argv;
if (args[2] === "--target") {
  target = args[3];
}

let os;
let arch;
if (target) {
  [os, arch] = target.split("-");
} else {
  [os, arch] = autodetectPlatformAndArch();
}

if (os === "alpine") {
  os = "linux";
}
if (arch === "armhf") {
  arch = "arm64";
}
target = `${os}-${arch}`;
console.log("[info] Using target: ", target);

const exe = os === "win32" ? ".exe" : "";

console.log("[info] Using target: ", target);

function ghAction() {
  return !!process.env.GITHUB_ACTIONS;
}

async function package(target, os, arch, exe) {
  console.log("[info] Packaging extension for target ", target);

  // Copy config_schema to intellij
  await generateAndCopyConfigYamlSchema();

  // Install node_modules
  await npmInstall();

  // Build gui and copy to extensions
  await buildGui(ghAction());

  // Assets
  // Copy tree-sitter-wasm files
  await copyTreeSitterWasms();

  // Install and copy over native modules
  // *** onnxruntime-node ***
  await copyOnnxRuntimeFromNodeModules(target);

  // copy llama tokenizers to out
  copyTokenizers();

  // Copy Linux scripts
  await copyScripts();

  // *** Install @lancedb binary ***
  const lancePackageToInstall = {
    "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
    "darwin-x64": "@lancedb/vectordb-darwin-x64",
    "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
    "linux-x64": "@lancedb/vectordb-linux-x64-gnu",
    "win32-x64": "@lancedb/vectordb-win32-x64-msvc",
    "win32-arm64": "@lancedb/vectordb-win32-x64-msvc", // they don't have a win32-arm64 build
  }[target];
  await installNodeModuleInTempDirAndCopyToCurrent(
    lancePackageToInstall,
    "@lancedb",
  );

  // *** sqlite ***
  await downloadSqliteBinary(target);
  await copySqliteBinary();

  await downloadRipgrepBinary(target);

  // copy node_modules to out/node_modules
  await copyNodeModules();

  // Copy over any worker files
  fs.cpSync(
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
    "out/xhr-sync-worker.js",
  );

  // Validate the all of the necessary files are present
  validateFilesPresent([
    // Queries used to create the index for @code context provider
    "tree-sitter/code-snippet-queries/c_sharp.scm",

    // Queries used for @outline and @highlights context providers
    "tag-qry/tree-sitter-c_sharp-tags.scm",

    // onnx runtime bindngs
    `bin/napi-v3/${os}/${arch}/onnxruntime_binding.node`,
    `bin/napi-v3/${os}/${arch}/${
      os === "darwin"
        ? "libonnxruntime.1.14.0.dylib"
        : os === "linux"
          ? "libonnxruntime.so.1.14.0"
          : "onnxruntime.dll"
    }`,

    // Code/styling for the sidebar
    "gui/assets/index.js",
    "gui/assets/index.css",

    // Tutorial
    "media/move-chat-panel-right.md",
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
    // "out/extension.js", This is generated afterward by vsce
    // web-tree-sitter
    "out/tree-sitter.wasm",
    // Worker required by jsdom
    "out/xhr-sync-worker.js",
    // SQLite3 Node native module
    "out/build/Release/node_sqlite3.node",

    // out/node_modules (to be accessed by extension.js)
    `out/node_modules/@vscode/ripgrep/bin/rg${exe}`,
    `out/node_modules/@lancedb/vectordb-${
      os === "win32"
        ? "win32-x64-msvc"
        : `${target}${os === "linux" ? "-gnu" : ""}`
    }/index.node`,
  ]);
}

void (async () => {
  await package(target, os, arch, exe);
  process.exit(0);
})();
