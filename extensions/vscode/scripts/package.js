/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// --- helpers
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function hasFlag(name) {
  return process.argv.includes(name);
}
function getFlagValue(name, def = undefined) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

// --- constants
const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(ROOT, "package.json");
const version = readJson(PKG).version;

// args we accept from CI: --target, --pre-release
const target = getFlagValue("--target");
const isPreRelease = hasFlag("--pre-release");

// make sure ./build exists (where we put the .vsix and esbuild meta)
const buildDir = path.join(ROOT, "build");
ensureDir(buildDir);

// try to point esbuild at the platform binary we staged in node_modules/@esbuild/<target>/**/esbuild
function esbuildBinForCurrentPlatform() {
  const nm = path.resolve(ROOT, "node_modules");
  const plat = process.platform;
  const arch = process.arch;
  const key = `${plat}-${arch}`;
  const map = {
    "darwin-arm64": ["@esbuild", "darwin-arm64", "bin", "esbuild"],
    "darwin-x64": ["@esbuild", "darwin-x64", "bin", "esbuild"],
    "linux-x64": ["@esbuild", "linux-x64", "bin", "esbuild"],
    "linux-arm64": ["@esbuild", "linux-arm64", "bin", "esbuild"],
    "win32-x64": ["@esbuild", "win32-x64", "esbuild.exe"],
    "win32-arm64": ["@esbuild", "win32-arm64", "esbuild.exe"],
  };
  const parts = map[key];
  return parts ? path.join(nm, ...parts) : null;
}

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

// --- main
(function main() {
  // Force ESBUILD_BINARY_PATH to the staged binary when present
  const env = { ...process.env };
  const bin = esbuildBinForCurrentPlatform();
  if (bin && fs.existsSync(bin)) {
    env.ESBUILD_BINARY_PATH = bin;
    console.log(`[info] Using ESBUILD_BINARY_PATH=${bin}`);
    try {
      // show versions for diagnostics
      const hostVer = readJson(
        path.join(ROOT, "node_modules", "esbuild", "package.json"),
      ).version;
      console.log(`[debug] esbuild host version: ${hostVer}`);
      run(`"${bin}" --version`, { env });
    } catch {}
  } else {
    console.warn(
      "[warn] Could not resolve platform esbuild binary; proceeding without ESBUILD_BINARY_PATH",
    );
  }

  // Build the vsce command; ALWAYS write to ./build/
  let vsce = `npx @vscode/vsce package --out ./build --no-dependencies`;
  if (isPreRelease) vsce += " --pre-release";
  if (target) vsce += ` --target ${target}`;

  // Execute packaging
  run(vsce, { cwd: ROOT, env });

  console.log(
    `vsce package completed - look in ./build for continue-${version}*.vsix`,
  );
})();
