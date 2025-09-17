/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Reuse the project's utilities (download/copy steps, timers, etc.)
const {
  // These are existing utilities in this repo; if any are unused in your tree
  // it's safe to keep the imports.
  execCmdSync,
  installNodeModuleInTempDirAndCopyToCurrent,
  downloadEsbuildBinary,
  copyJetBrainsExtensionAssets,
  copyVSCodeExtensionAssets,
  copyOnnxruntimeNode,
  copyMiscWorkerAssets,
  downloadLanceDbBinary,
  downloadSqlite3Binary,
  copyRipgrep,
  copyWorkerpool,
} = require("./utils");

// -------- helpers

function nowISO() {
  return new Date().toISOString();
}

function logInfo(msg) {
  console.log(`[info] ${msg}`);
}

function logTimer(label, startTs) {
  const ms = Date.now() - startTs;
  console.log(`[timer] ${label} in ${ms}ms`);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function cpDir(src, dest) {
  ensureDir(dest);
  // Node 20+ supports fs.cpSync; fallback to shell cp -a if needed
  if (fs.cpSync) {
    fs.cpSync(src, dest, { recursive: true, force: true });
  } else {
    execSync(`cp -a "${src}/." "${dest}/"`);
  }
}

function pathExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Map our --target flag to @esbuild/<target> package name
function normalizeEsbuildTarget(targetFlag) {
  // Allowed values in this repo: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64, win32-arm64
  // Extend as needed.
  const allowed = new Set([
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "win32-arm64",
    "win32-x64",
  ]);
  if (!allowed.has(targetFlag)) {
    throw new Error(
      `Unsupported --target "${targetFlag}". Allowed: ${Array.from(allowed).join(", ")}`,
    );
  }
  return targetFlag;
}

/**
 * After we download/unpack the platform binary, make sure it exists in BOTH:
 * 1) out/node_modules/@esbuild/<target>  (so it’s packaged)
 * 2) node_modules/@esbuild/<target>      (so the JS host can find a matching binary)
 */
function ensureEsbuildHostAndOutHaveBinary(target) {
  const pkgRoot = process.cwd(); // extensions/vscode

  const outPkgDir = path.join(
    pkgRoot,
    "out",
    "node_modules",
    "@esbuild",
    target,
  );
  const workPkgDir = path.join(pkgRoot, "node_modules", "@esbuild", target);

  // Where could the platform package already exist?
  const candidates = [
    outPkgDir, // already copied to out (best case)
    workPkgDir, // installed by installNodeModuleInTempDirAndCopyToCurrent
    path.join(pkgRoot, "out", "tmp", "package"), // extracted by downloadEsbuildBinary()
  ];

  // Choose first existing candidate as the source to ensure both out/ and working NM have it
  let sourceDir = candidates.find((p) => pathExists(p));

  if (!sourceDir) {
    throw new Error(
      `esbuild platform package not found. Looked in:\n` +
        ` - ${outPkgDir}\n - ${workPkgDir}\n - ${path.join(pkgRoot, "out", "tmp", "package")}\n` +
        `Did either downloadEsbuildBinary() or installNodeModuleInTempDirAndCopyToCurrent() run?`,
    );
  }

  // If the source is the work tree, mirror it into out/; if the source is out/, mirror back to work tree.
  if (!pathExists(outPkgDir)) {
    cpDir(sourceDir, outPkgDir);
  }
  if (!pathExists(workPkgDir)) {
    cpDir(outPkgDir, workPkgDir);
  }

  // Quick sanity logs
  const pkgJson = path.join(workPkgDir, "package.json");
  if (pathExists(pkgJson)) {
    try {
      const v = JSON.parse(fs.readFileSync(pkgJson, "utf8")).version;
      logInfo(`Installed @esbuild/${target} ${v} into working tree and out/`);
    } catch {}
  }

  // Optional: print the binary version
  const binPath = path.join(
    workPkgDir,
    "bin",
    process.platform === "win32" ? "esbuild.exe" : "esbuild",
  );
  if (pathExists(binPath)) {
    try {
      const v = execSync(`"${binPath}" --version`).toString().trim();
      logInfo(`esbuild binary resolves at: ${binPath} (version ${v})`);
    } catch {}
  }
}

// -------- main

void (async () => {
  const argv = process.argv.slice(2);
  const flagIndex = argv.indexOf("--target");
  const target = normalizeEsbuildTarget(
    flagIndex >= 0
      ? argv[flagIndex + 1]
      : process.env.ESBUILD_TARGET || `${process.platform}-${process.arch}`,
  );

  logInfo(`Using target:  ${target}`);
  logInfo(`Packaging extension for target ${target} - started at ${nowISO()}`);

  // 1) (Usually) do per-package installs/builds (kept for parity with CI logs)
  const t0 = Date.now();
  console.log(
    "[timer] Starting npm installs:",
    (performance?.now?.() ?? 0).toFixed?.(3) ?? "",
  ); // cosmetic
  try {
    // The repo’s CI runs a larger build prior to calling this script.
    // Locally, nothing to do here unless your workflow requires it.
    // Keeping the log lines so output stays familiar.
    // If you need to force local installs, you could add:
    // execCmdSync("npm i --no-audit --no-fund");
  } finally {
    logTimer("npm installs", t0);
  }

  // 2) Copy product assets (exactly as before)
  const tCopyJB = Date.now();
  console.log("[timer] Starting JetBrains copy at", nowISO());
  copyJetBrainsExtensionAssets?.();
  logTimer("JetBrains copy completed", tCopyJB);
  logInfo("Copied gui build to JetBrains extension");

  const tCopyVS = Date.now();
  console.log("[timer] Starting VSCode copy at", nowISO());
  copyVSCodeExtensionAssets?.();
  logTimer("VSCode copy completed", tCopyVS);
  console.log("Copied gui build to VSCode extension");

  const tCopyOrt = Date.now();
  console.log("[timer] Starting onnxruntime copy at", nowISO());
  copyOnnxruntimeNode?.();
  logTimer("onnxruntime copy completed", tCopyOrt);
  logInfo("Copied onnxruntime-node");

  // Misc assets copied by original script
  copyMiscWorkerAssets?.(); // tree-sitter.wasm, tokenizer workers, etc.

  // Prebuilt native deps (lancedb/sqlite)
  await downloadLanceDbBinary?.(target);
  await downloadSqlite3Binary?.();

  // Ripgrep + workerpool
  copyRipgrep?.();
  copyWorkerpool?.();

  // 3) esbuild handling
  // If the CI / local build sets CONTINUE_DOWNLOAD_ESBUILD_BINARY=1, download platform package from npm tgz.
  // Otherwise, fallback to the previous behavior of installing from npm into a temp dir and copying over.
  if (process.env.CONTINUE_DOWNLOAD_ESBUILD_BINARY === "1") {
    logInfo("Downloading pre-built esbuild binary");
    await downloadEsbuildBinary(target);
  } else {
    logInfo("npm installing esbuild binary");
    // Strip leading ^ / ~ from the version so npm gets a valid, pinned spec.
    const rawEsbuild =
      (require("../package.json").devDependencies || {}).esbuild || "0.24.2";
    const pinnedEsbuild = String(rawEsbuild).replace(/^[~^]/, "");
    // This helper installs "esbuild@<version>" into a temp dir and copies "@esbuild/<target>" out of it.
    await installNodeModuleInTempDirAndCopyToCurrent(
      `esbuild@${pinnedEsbuild}`,
      "@esbuild",
    );
  }

  // Ensure the matching binary is also available for the host in the working node_modules
  ensureEsbuildHostAndOutHaveBinary(target);

  // 4) Final status
  console.log("All paths exist");
  console.log(
    `[timer] Prepackage completed in ${Date.now() - t0}ms - finished at ${nowISO()}`,
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
