const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");
const { rimrafSync } = require("rimraf");
const {
  validateFilesPresent,
  execCmdSync,
  autodetectPlatformAndArch,
} = require("../../../scripts/util/index");

const continueDir = path.join(__dirname, "..", "..", "..");

function generateConfigYamlSchema() {
  process.chdir(path.join(continueDir, "packages", "config-yaml"));
  execCmdSync("npm install");
  execCmdSync("npm run build");
  execCmdSync("npm run generate-schema");
  fs.copyFileSync(
    path.join("schema", "config-yaml-schema.json"),
    path.join(continueDir, "extensions", "vscode", "config-yaml-schema.json"),
  );
  console.log("[info] Generated config.yaml schema");
}

function copyConfigSchema() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  // Modify and copy for .continuerc.json
  const schema = JSON.parse(fs.readFileSync("config_schema.json", "utf8"));
  schema.$defs.SerializedContinueConfig.properties.mergeBehavior = {
    type: "string",
    enum: ["merge", "overwrite"],
    default: "merge",
    title: "Merge behavior",
    markdownDescription:
      "If set to 'merge', .continuerc.json will be applied on top of config.json (arrays and objects are merged). If set to 'overwrite', then every top-level property of .continuerc.json will overwrite that property from config.json.",
    "x-intellij-html-description":
      "<p>If set to <code>merge</code>, <code>.continuerc.json</code> will be applied on top of <code>config.json</code> (arrays and objects are merged). If set to <code>overwrite</code>, then every top-level property of <code>.continuerc.json</code> will overwrite that property from <code>config.json</code>.</p>",
  };
  fs.writeFileSync("continue_rc_schema.json", JSON.stringify(schema, null, 2));

  // Copy config schemas to intellij
  fs.copyFileSync(
    "config_schema.json",
    path.join(
      "..",
      "intellij",
      "src",
      "main",
      "resources",
      "config_schema.json",
    ),
  );
  fs.copyFileSync(
    "continue_rc_schema.json",
    path.join(
      "..",
      "intellij",
      "src",
      "main",
      "resources",
      "continue_rc_schema.json",
    ),
  );
}

function copyTokenizers() {
  fs.copyFileSync(
    path.join(__dirname, "../../../core/llm/llamaTokenizerWorkerPool.mjs"),
    path.join(__dirname, "../out/llamaTokenizerWorkerPool.mjs"),
  );
  console.log("[info] Copied llamaTokenizerWorkerPool");

  fs.copyFileSync(
    path.join(__dirname, "../../../core/llm/llamaTokenizer.mjs"),
    path.join(__dirname, "../out/llamaTokenizer.mjs"),
  );
  console.log("[info] Copied llamaTokenizer");
}

function installNodeModules() {
  // Make sure we are in the right directory
  if (!process.cwd().endsWith("vscode")) {
    process.chdir(path.join(continueDir, "extensions", "vscode"));
  }

  // Install node_modules //
  execCmdSync("npm install");
  console.log("[info] npm install in extensions/vscode completed");

  process.chdir(path.join(continueDir, "gui"));

  execCmdSync("npm install");
  console.log("[info] npm install in gui completed");
}

async function buildGui(isGhAction) {
  // Make sure we are in the right directory
  if (!process.cwd().endsWith("gui")) {
    process.chdir(path.join(continueDir, "gui"));
  }
  if (isGhAction) {
    execCmdSync("npm run build");
  }

  // Copy over the dist folder to the JetBrains extension //
  const intellijExtensionWebviewPath = path.join(
    "..",
    "extensions",
    "intellij",
    "src",
    "main",
    "resources",
    "webview",
  );

  const indexHtmlPath = path.join(intellijExtensionWebviewPath, "index.html");
  fs.copyFileSync(indexHtmlPath, "tmp_index.html");
  rimrafSync(intellijExtensionWebviewPath);
  fs.mkdirSync(intellijExtensionWebviewPath, { recursive: true });

  await new Promise((resolve, reject) => {
    ncp("dist", intellijExtensionWebviewPath, (error) => {
      if (error) {
        console.warn(
          "[error] Error copying React app build to JetBrains extension: ",
          error,
        );
        reject(error);
      }
      resolve();
    });
  });

  // Put back index.html
  if (fs.existsSync(indexHtmlPath)) {
    rimrafSync(indexHtmlPath);
  }
  fs.copyFileSync("tmp_index.html", indexHtmlPath);
  fs.unlinkSync("tmp_index.html");

  console.log("[info] Copied gui build to JetBrains extension");

  // Then copy over the dist folder to the VSCode extension //
  const vscodeGuiPath = path.join("../extensions/vscode/gui");
  fs.mkdirSync(vscodeGuiPath, { recursive: true });
  await new Promise((resolve, reject) => {
    ncp("dist", vscodeGuiPath, (error) => {
      if (error) {
        console.log(
          "Error copying React app build to VSCode extension: ",
          error,
        );
        reject(error);
      } else {
        console.log("Copied gui build to VSCode extension");
        resolve();
      }
    });
  });

  if (!fs.existsSync(path.join("dist", "assets", "index.js"))) {
    throw new Error("gui build did not produce index.js");
  }
  if (!fs.existsSync(path.join("dist", "assets", "index.css"))) {
    throw new Error("gui build did not produce index.css");
  }
}

async function copyOnnxRuntimeFromNodeModules(target) {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  fs.mkdirSync("bin", { recursive: true });

  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/onnxruntime-node/bin"),
      path.join(__dirname, "../bin"),
      {
        dereference: true,
      },
      (error) => {
        if (error) {
          console.warn("[info] Error copying onnxruntime-node files", error);
          reject(error);
        }
        resolve();
      },
    );
  });
  if (target) {
    // If building for production, only need the binaries for current platform
    try {
      if (!target.startsWith("darwin")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/darwin"));
      }
      if (!target.startsWith("linux")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/linux"));
      }
      if (!target.startsWith("win")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/win32"));
      }

      // Also don't want to include cuda/shared/tensorrt binaries, they are too large
      if (target.startsWith("linux")) {
        const filesToRemove = [
          "libonnxruntime_providers_cuda.so",
          "libonnxruntime_providers_shared.so",
          "libonnxruntime_providers_tensorrt.so",
        ];
        filesToRemove.forEach((file) => {
          const filepath = path.join(
            __dirname,
            "../bin/napi-v3/linux/x64",
            file,
          );
          if (fs.existsSync(filepath)) {
            fs.rmSync(filepath);
          }
        });
      }
    } catch (e) {
      console.warn("[info] Error removing unused binaries", e);
    }
  }
  console.log("[info] Copied onnxruntime-node");
}

async function copyTreeSitterWasms() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  fs.mkdirSync("out", { recursive: true });

  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/tree-sitter-wasms/out"),
      path.join(__dirname, "../out/tree-sitter-wasms"),
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

  fs.copyFileSync(
    path.join(__dirname, "../../../core/vendor/tree-sitter.wasm"),
    path.join(__dirname, "../out/tree-sitter.wasm"),
  );
  console.log("[info] Copied tree-sitter wasms");
}

async function copyTreeSitterTagQryFiles() {
  // ncp(
  //   path.join(
  //     __dirname,
  //     "../../../core/node_modules/llm-code-highlighter/dist/tag-qry",
  //   ),
  //   path.join(__dirname, "../out/tag-qry"),
  //   (error) => {
  //     if (error)
  //       console.warn("Error copying code-highlighter tag-qry files", error);
  //   },
  // );
}

async function copyNodeModules() {
  // Copy node_modules for pre-built binaries
  process.chdir(path.join(continueDir, "extensions", "vscode"));

  const NODE_MODULES_TO_COPY = [
    "esbuild",
    "@esbuild",
    "@lancedb",
    "@vscode/ripgrep",
    "workerpool",
  ];
  fs.mkdirSync("out/node_modules", { recursive: true });

  await Promise.all(
    NODE_MODULES_TO_COPY.map(
      (mod) =>
        new Promise((resolve, reject) => {
          fs.mkdirSync(`out/node_modules/${mod}`, { recursive: true });
          ncp(
            `node_modules/${mod}`,
            `out/node_modules/${mod}`,
            { dereference: true },
            function (error) {
              if (error) {
                console.error(`[error] Error copying ${mod}`, error);
                reject(error);
              } else {
                console.log(`[info] Copied ${mod}`);
                resolve();
              }
            },
          );
        }),
    ),
  );

  console.log(`[info] Copied ${NODE_MODULES_TO_COPY.join(", ")}`);
}

// async function downloadEsbuildBinary(isGhAction, isArm, target) {
//   process.chdir(path.join(continueDir, "extensions", "vscode"));

//   if (isGhAction && isArm) {
//     // Download and unzip esbuild
//     console.log("[info] Downloading pre-built esbuild binary");
//     rimrafSync("node_modules/@esbuild");
//     fs.mkdirSync("node_modules/@esbuild", { recursive: true });
//     execCmdSync(
//       `curl -o node_modules/@esbuild/esbuild.zip https://continue-server-binaries.s3.us-west-1.amazonaws.com/${target}/esbuild.zip`,
//     );
//     execCmdSync(`cd node_modules/@esbuild && unzip esbuild.zip`);
//     fs.unlinkSync("node_modules/@esbuild/esbuild.zip");
//   } else {
//     // Download esbuild from npm in tmp and copy over
//     console.log("npm installing esbuild binary");
//     await installNodeModuleInTempDirAndCopyToCurrent(
//       "esbuild@0.17.19",
//       "@esbuild",
//     );
//   }
// }

async function downloadEsbuildBinary(target) {
  console.log("[info] Downloading pre-built esbuild binary");
  rimrafSync("out/node_modules/@esbuild");
  fs.mkdirSync(`out/node_modules/@esbuild/${target}/bin`, { recursive: true });
  fs.mkdirSync(`out/tmp`, { recursive: true });
  const downloadUrl = {
    "darwin-arm64":
      "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.17.19.tgz",
    "linux-arm64":
      "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.17.19.tgz",
    "win32-arm64":
      "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.17.19.tgz",
    "linux-x64":
      "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.17.19.tgz",
    "darwin-x64":
      "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.17.19.tgz",
    "win32-x64":
      "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.17.19.tgz",
  }[target];
  execCmdSync(`curl -L -o out/tmp/esbuild.tgz ${downloadUrl}`);
  execCmdSync("cd out/tmp && tar -xvzf esbuild.tgz");
  // Copy the installed package back to the current directory
  let tmpPath = "out/tmp/package/bin";
  let outPath = `out/node_modules/@esbuild/${target}/bin`;
  if (target.startsWith("win")) {
    tmpPath = "out/tmp/package";
    outPath = `out/node_modules/@esbuild/${target}`;
  }

  await new Promise((resolve, reject) => {
    ncp(
      path.join(tmpPath),
      path.join(outPath),
      { dereference: true },
      (error) => {
        if (error) {
          console.error(`[error] Error copying esbuild package`, error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
  rimrafSync("out/tmp");
}

async function downloadSqliteBinary(target) {
  console.log("[info] Downloading pre-built sqlite3 binary");
  rimrafSync("../../core/node_modules/sqlite3/build");
  const downloadUrl = {
    "darwin-arm64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
    "linux-arm64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
    "win32-arm64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-win32-arm64.tar.gz",
    "linux-x64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-x64.tar.gz",
    "darwin-x64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-x64.tar.gz",
    "win32-x64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz",
  }[target];
  execCmdSync(
    `curl -L -o ../../core/node_modules/sqlite3/build.tar.gz ${downloadUrl}`,
  );
  execCmdSync("cd ../../core/node_modules/sqlite3 && tar -xvzf build.tar.gz");
  fs.unlinkSync("../../core/node_modules/sqlite3/build.tar.gz");
}

async function copySqliteBinary() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  console.log("[info] Copying sqlite node binding from core");
  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/sqlite3/build"),
      path.join(__dirname, "../out/build"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] Error copying sqlite3 files", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
}

async function downloadRipgrepBinary(target) {
  console.log("[info] Downloading pre-built ripgrep binary");
  rimrafSync("node_modules/@vscode/ripgrep/bin");
  fs.mkdirSync("node_modules/@vscode/ripgrep/bin", { recursive: true });
  4;
  const downloadUrl = {
    "darwin-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-apple-darwin.tar.gz",
    "linux-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-unknown-linux-gnu.tar.gz",
    "win32-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-pc-windows-msvc.zip",
    "linux-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-unknown-linux-musl.tar.gz",
    "darwin-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-apple-darwin.tar.gz",
    "win32-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-pc-windows-msvc.zip",
  }[target];

  if (target.startsWith("win")) {
    execCmdSync(
      `curl -L -o node_modules/@vscode/ripgrep/bin/build.zip ${downloadUrl}`,
    );
    execCmdSync("cd node_modules/@vscode/ripgrep/bin && unzip build.zip");
    fs.unlinkSync("node_modules/@vscode/ripgrep/bin/build.zip");
  } else {
    execCmdSync(
      `curl -L -o node_modules/@vscode/ripgrep/bin/build.tar.gz ${downloadUrl}`,
    );
    execCmdSync(
      "cd node_modules/@vscode/ripgrep/bin && tar -xvzf build.tar.gz",
    );
    fs.unlinkSync("node_modules/@vscode/ripgrep/bin/build.tar.gz");
  }
}

async function installNodeModuleInTempDirAndCopyToCurrent(packageName, toCopy) {
  console.log(`Copying ${packageName} to ${toCopy}`);
  // This is a way to install only one package without npm trying to install all the dependencies
  // Create a temporary directory for installing the package
  const adjustedName = packageName.replace(/@/g, "").replace("/", "-");

  const tempDir = `/tmp/continue-node_modules-${adjustedName}`;
  const currentDir = process.cwd();

  // Remove the dir we will be copying to
  rimrafSync(`node_modules/${toCopy}`);

  // Ensure the temporary directory exists
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
    // Ideally we validate file integrity in the validation at the end
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

async function copyScripts() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  console.log("[info] Copying scripts from core");
  fs.copyFileSync(
    path.join(__dirname, "../../../core/util/start_ollama.sh"),
    path.join(__dirname, "../out/start_ollama.sh"),
  );
  console.log("[info] Copied script files");
}

// We can't simply touch one of our files to trigger a rebuild, because
// esbuild doesn't always use modifications times to detect changes -
// for example, if it finds a file changed within the last 3 seconds,
// it will fall back to full-contents-comparison for that file
//
// So to facilitate development workflows, we always include a timestamp string
// in the build
function writeBuildTimestamp() {
  fs.writeFileSync(
    "src/.buildTimestamp.ts",
    `export default "${new Date().toISOString()}";\n`,
  );
}

module.exports = {
  generateConfigYamlSchema,
  copyConfigSchema,
  installNodeModules,
  buildGui,
  copyOnnxRuntimeFromNodeModules,
  copyTreeSitterWasms,
  copyTreeSitterTagQryFiles,
  copyNodeModules,
  downloadEsbuildBinary,
  copySqliteBinary,
  installNodeModuleInTempDirAndCopyToCurrent,
  downloadSqliteBinary,
  downloadRipgrepBinary,
  copyTokenizers,
  copyScripts,
  writeBuildTimestamp,
};
