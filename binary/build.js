const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const ncp = require("ncp").ncp;
const { rimrafSync } = require("rimraf");
const {
  validateFilesPresent,
  execCmdSync,
  autodetectPlatformAndArch,
} = require("../scripts/util");

// Clean slate
const bin = path.join(__dirname, "bin");
const out = path.join(__dirname, "out");
const build = path.join(__dirname, "build");
rimrafSync(bin);
rimrafSync(out);
rimrafSync(build);
rimrafSync(path.join(__dirname, "tmp"));
fs.mkdirSync(bin);
fs.mkdirSync(out);
fs.mkdirSync(build);

const esbuildOutputFile = "out/index.js";
let targets = [
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
];

const [currentPlatform, currentArch] = autodetectPlatformAndArch();

const assetBackups = [
  "node_modules/win-ca/lib/crypt32-ia32.node.bak",
  "node_modules/win-ca/lib/crypt32-x64.node.bak",
];

let esbuildOnly = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--esbuild-only") {
    esbuildOnly = true;
  }
  if (process.argv[i - 1] === "--target") {
    targets = [process.argv[i]];
  }
}

const targetToLanceDb = {
  "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
  "darwin-x64": "@lancedb/vectordb-darwin-x64",
  "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
  "linux-x64": "@lancedb/vectordb-linux-x64-gnu",
  "win32-x64": "@lancedb/vectordb-win32-x64-msvc",
  "win32-arm64": "@lancedb/vectordb-win32-arm64-msvc",
};

async function installNodeModuleInTempDirAndCopyToCurrent(packageName, toCopy) {
  console.log(`Copying ${packageName} to ${toCopy}`);
  // This is a way to install only one package without npm trying to install all the dependencies
  // Create a temporary directory for installing the package
  const adjustedName = packageName.replace(/@/g, "").replace("/", "-");
  const tempDir = path.join(
    __dirname,
    "tmp",
    `continue-node_modules-${adjustedName}`,
  );
  const currentDir = process.cwd();

  // // Remove the dir we will be copying to
  // rimrafSync(`node_modules/${toCopy}`);

  // // Ensure the temporary directory exists
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Move to the temporary directory
    process.chdir(tempDir);

    // Initialize a new package.json and install the package
    execCmdSync(`npm init -y && npm i -f ${packageName} --no-save`);

    console.log(
      `Contents of: ${packageName}`,
      fs.readdirSync(path.join(tempDir, "node_modules", toCopy)),
    );

    // Without this it seems the file isn't completely written to disk
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Copy the installed package back to the current directory
    await new Promise((resolve, reject) => {
      ncp(
        path.join(tempDir, "node_modules", toCopy),
        path.join(currentDir, "node_modules", toCopy),
        { dereference: true },
        (error) => {
          if (error) {
            console.error(
              `[error] Error copying ${packageName} package`,
              error,
            );
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
  } finally {
    // Clean up the temporary directory
    // rimrafSync(tempDir);

    // Return to the original directory
    process.chdir(currentDir);
  }
}

(async () => {
  // Informs of where to look for node_sqlite3.node https://www.npmjs.com/package/bindings#:~:text=The%20searching%20for,file%20is%20found
  // This is only needed for our `pkg` command at build time
  fs.writeFileSync(
    "out/package.json",
    JSON.stringify(
      {
        name: "binary",
        version: "1.0.0",
        author: "Continue Dev, Inc",
        license: "Apache-2.0",
      },
      undefined,
      2,
    ),
  );

  console.log("[info] Downloading prebuilt lancedb...");
  for (const target of targets) {
    if (targetToLanceDb[target]) {
      console.log(`[info] Downloading for ${target}...`);
      await installNodeModuleInTempDirAndCopyToCurrent(
        targetToLanceDb[target],
        "@lancedb",
      );
    }
  }

  // tree-sitter-wasm
  const treeSitterWasmsDir = path.join(out, "tree-sitter-wasms");
  fs.mkdirSync(treeSitterWasmsDir);
  await new Promise((resolve, reject) => {
    ncp(
      path.join(
        __dirname,
        "..",
        "core",
        "node_modules",
        "tree-sitter-wasms",
        "out",
      ),
      treeSitterWasmsDir,
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] Error copying tree-sitter-wasm files", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  const filesToCopy = [
    "../core/vendor/tree-sitter.wasm",
    "../core/llm/llamaTokenizerWorkerPool.mjs",
    "../core/llm/llamaTokenizer.mjs",
    "../core/llm/tiktokenWorkerPool.mjs",
  ];
  for (const f of filesToCopy) {
    fs.copyFileSync(
      path.join(__dirname, f),
      path.join(__dirname, "out", path.basename(f)),
    );
    console.log(`[info] Copied ${path.basename(f)}`);
  }

  console.log("[info] Cleaning up artifacts from previous builds...");

  // delete asset backups generated by previous pkg invocations, if present
  for (const assetPath of assetBackups) {
    fs.rmSync(assetPath, { force: true });
  }

  // Bundles the extension into one file
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
    loader: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ".node": "file",
    },

    // To allow import.meta.path for transformers.js
    // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
    inject: ["./importMetaUrl.js"],
    define: { "import.meta.url": "importMetaUrl" },
  });

  // Copy over any worker files
  fs.cpSync(
    "../core/node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
    "out/xhr-sync-worker.js",
  );
  fs.cpSync("../core/llm/tiktokenWorkerPool.mjs", "out/tiktokenWorkerPool.mjs");
  fs.cpSync(
    "../core/llm/llamaTokenizerWorkerPool.mjs",
    "out/llamaTokenizerWorkerPool.mjs",
  );

  if (esbuildOnly) {
    return;
  }

  console.log("[info] Building binaries with pkg...");
  for (const target of targets) {
    const targetDir = `bin/${target}`;
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`[info] Building ${target}...`);
    execCmdSync(
      `npx pkg --no-bytecode --public-packages "*" --public pkgJson/${target} --out-path ${targetDir}`,
    );

    // Download and unzip prebuilt sqlite3 binary for the target
    console.log("[info] Downloading node-sqlite3");
    const downloadUrl = `https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-${
      target === "win32-arm64" ? "win32-ia32" : target
    }.tar.gz`;
    execCmdSync(`curl -L -o ${targetDir}/build.tar.gz ${downloadUrl}`);
    execCmdSync(`cd ${targetDir} && tar -xvzf build.tar.gz`);

    // Copy to build directory for testing
    try {
      const [platform, arch] = target.split("-");
      if (platform === currentPlatform && arch === currentArch) {
        fs.copyFileSync(
          `${targetDir}/build/Release/node_sqlite3.node`,
          `build/node_sqlite3.node`,
        );
      }
    } catch (error) {
      console.log("[warn] Could not copy node_sqlite to build");
      console.log(error);
    }

    fs.unlinkSync(`${targetDir}/build.tar.gz`);

    // copy @lancedb to bin folders
    console.log("[info] Copying @lancedb files to bin");
    fs.copyFileSync(
      `node_modules/${targetToLanceDb[target]}/index.node`,
      `${targetDir}/index.node`,
    );

    // Informs the `continue-binary` of where to look for node_sqlite3.node
    // https://www.npmjs.com/package/bindings#:~:text=The%20searching%20for,file%20is%20found
    // fs.writeFileSync(`${targetDir}/package.json`, "");
  }

  // Cleanup - this is needed when running locally
  fs.rmSync("out/package.json");

  const pathsToVerify = [];
  for (const target of targets) {
    const exe = target.startsWith("win") ? ".exe" : "";
    const targetDir = `bin/${target}`;
    pathsToVerify.push(
      `${targetDir}/continue-binary${exe}`,
      `${targetDir}/index.node`, // @lancedb
      `${targetDir}/build/Release/node_sqlite3.node`,
    );
  }

  // Note that this doesn't verify they actually made it into the binary, just that they were in the expected folder before it was built
  pathsToVerify.push("out/index.js");
  pathsToVerify.push("out/llamaTokenizerWorkerPool.mjs");
  pathsToVerify.push("out/tiktokenWorkerPool.mjs");
  pathsToVerify.push("out/xhr-sync-worker.js");
  pathsToVerify.push("out/tree-sitter.wasm");

  validateFilesPresent(pathsToVerify);

  console.log("[info] Done!");
})();
