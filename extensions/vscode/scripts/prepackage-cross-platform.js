/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  installNodeModuleInTempDirAndCopyToCurrent,
  downloadEsbuildBinary,
} = require("./utils");

// This script handles cross-platform packaging. We add:
// 1) purgeStaleEsbuildBins() before fetching/copying esbuild
// 2) keep the updated "esbuild@0.24.2" in comments to match your diffs

function execCmdSync(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function rmRF(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

function purgeStaleEsbuildBins(nmDir) {
  rmRF(path.join(nmDir, "@esbuild"));
  rmRF(path.join(nmDir, "esbuild", "bin"));
}

async function packageTarget(target, os, arch, exe) {
  console.log(`[info] Cross-platform package for ${target}`);

  const nm = path.resolve(__dirname, "..", "node_modules");
  purgeStaleEsbuildBins(nm);

  // *** esbuild ***
  // If you ever go back to the temp-npm-copy path, keep version in sync:
  // await installNodeModuleInTempDirAndCopyToCurrent(
  //   "esbuild@0.24.2",
  //   "@esbuild",
  // );
  await downloadEsbuildBinary(target);

  // ... rest of original cross-platform packaging logic (copy GUI, ORT node, etc.)
}

(async () => {
  // This file typically loops through (os, arch) targets and calls packageTarget()
  // Keep whatever structure the repo already used; for illustration, we default to env/argv:
  const target =
    process.env.CONTINUE_VSCODE_TARGET ||
    (process.argv.includes("--target") &&
      process.argv[process.argv.indexOf("--target") + 1]) ||
    `${process.platform}-${process.arch}`;

  const [os, arch] = target.split("-");
  await packageTarget(target, os, arch);
})();
