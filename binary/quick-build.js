const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const {
  execCmdSync,
  validateFilesPresent,
  autodetectPlatformAndArch,
} = require("../scripts/util");

// Paths
const bin = path.join(__dirname, "bin");
const esbuildOutputFile = "out/index.js";
let targets = [
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
];

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i - 1] === "--target") {
    targets = [process.argv[i]];
  }
}

// Cleanup
for (const target of targets) {
  const exe = target.startsWith("win") ? ".exe" : "";
  const targetDir = path.join(bin, target);
  fs.rmSync(path.join(targetDir, `continue-binary${exe}`), { force: true });
}

// Validate files to ensure prerequisites are available
const filesToValidate = [
  "src/index.ts",
  "../core/node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
  "../core/llm/tiktokenWorkerPool.mjs",
  "../core/llm/llamaTokenizerWorkerPool.mjs",
];
validateFilesPresent(filesToValidate);

// Quick Build
(async () => {
  console.log("[info] Building with esbuild...");
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: esbuildOutputFile,
    external: [
      "esbuild",
      "./xhr-sync-worker.js",
      "llamaTokenizerWorkerPool.mjs",
      "tiktokenWorkerPool.mjs",
      "vscode",
      "./index.node",
    ],
    format: "cjs",
    platform: "node",
    sourcemap: true,
    minify: true,
    treeShaking: true,
    loader: { ".node": "file" },
    inject: ["./importMetaUrl.js"],
    define: { "import.meta.url": "importMetaUrl" },
  });

  console.log("[info] Building binaries with pkg...");
  for (const target of targets) {
    const targetDir = path.join(bin, target);
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`[info] Building ${target}...`);
    execCmdSync(
      `npx pkg --no-bytecode --public-packages "*" --public pkgJson/${target} --out-path ${targetDir}`,
    );
  }

  // Validate only continue-binary files
  const pathsToVerify = targets.map((target) => {
    const exe = target.startsWith("win") ? ".exe" : "";
    return path.join(bin, target, `continue-binary${exe}`);
  });
  validateFilesPresent(pathsToVerify);

  console.log("[info] Quick build completed!");
})();
