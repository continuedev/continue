/**
 * Puts the ripgrep binary for a packaging target at
 * node_modules/@vscode/ripgrep/bin/rg(.exe), which is where prepackage copies it from and
 * where the extension looks for it at runtime (out/node_modules/@vscode/ripgrep/bin/rg).
 *
 * @vscode/ripgrep >= 1.16 no longer downloads a binary in a postinstall (that call went to
 * the GitHub API and needed a token to avoid rate limits). The binaries are published to npm
 * as one package per platform, e.g. @vscode/ripgrep-linux-x64. npm only installs the package
 * for the *host*, so for the target we `npm pack` it: that ignores the os/cpu restrictions,
 * needs no GitHub access and is verified against the integrity hash in package-lock.json.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PLATFORM_PACKAGES = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm",
  "linux-arm64",
  "linux-ia32",
  "linux-ppc64",
  "linux-riscv64",
  "linux-s390x",
  "linux-x64",
  "win32-arm64",
  "win32-ia32",
  "win32-x64",
]);

/**
 * Name of the @vscode/ripgrep platform package for a packaging target.
 *
 * @param {string} target e.g. "linux-x64", "darwin-arm64", "alpine-x64", "linux-armhf"
 * @param {string} [npmConfigArch] the build's npm_config_arch. CI sets it to "arm" for armhf
 *   while prepackage maps armhf to arm64 internally, so it wins over the target's arch, as it
 *   did for the old postinstall.
 */
function ripgrepPackageForTarget(target, npmConfigArch) {
  let [platform, arch] = String(target).split("-");
  if (platform === "alpine") platform = "linux"; // the linux binaries are static musl builds
  if (npmConfigArch) arch = npmConfigArch;
  if (arch === "armhf" || arch === "armv7l") arch = "arm";
  const suffix = `${platform}-${arch}`;
  if (!PLATFORM_PACKAGES.has(suffix)) {
    throw new Error(
      `No @vscode/ripgrep binary for target "${target}"${
        npmConfigArch ? ` (npm_config_arch=${npmConfigArch})` : ""
      }`,
    );
  }
  return `@vscode/ripgrep-${suffix}`;
}

function npmBin() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

/**
 * @param {string} target packaging target
 * @param {{ projectDir?: string, npmConfigArch?: string }} [options]
 *   projectDir: the extension directory (contains node_modules and package-lock.json)
 */
async function installRipgrepBinary(target, options = {}) {
  const projectDir = options.projectDir ?? process.cwd();
  const npmConfigArch =
    options.npmConfigArch ?? process.env.npm_config_arch ?? undefined;

  const wrapperDir = path.join(projectDir, "node_modules/@vscode/ripgrep");
  const { version } = JSON.parse(
    fs.readFileSync(path.join(wrapperDir, "package.json"), "utf8"),
  );
  const pkg = ripgrepPackageForTarget(target, npmConfigArch);
  const exe =
    pkg.endsWith("win32-x64") ||
    pkg.endsWith("win32-arm64") ||
    pkg.endsWith("win32-ia32")
      ? ".exe"
      : "";

  console.log(`[info] Installing ripgrep for ${target}: ${pkg}@${version}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "continued-ripgrep-"));
  try {
    // `npm pack` downloads the tarball whatever the host os/cpu is
    const packed = JSON.parse(
      execFileSync(
        npmBin(),
        ["pack", `${pkg}@${version}`, "--json", "--pack-destination", tmp],
        { encoding: "utf8", shell: process.platform === "win32" },
      ),
    )[0];

    // Verify against the lockfile so a build can't silently pick up a different binary
    const lockPath = path.join(projectDir, "package-lock.json");
    if (fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      const expected = lock.packages?.[`node_modules/${pkg}`]?.integrity;
      if (!expected) {
        throw new Error(
          `${pkg} is not in package-lock.json; run npm install to record it`,
        );
      }
      if (expected !== packed.integrity) {
        throw new Error(
          `Integrity mismatch for ${pkg}@${version}: lockfile ${expected}, registry ${packed.integrity}`,
        );
      }
    }

    // Relative names + cwd: GNU tar (Git Bash on Windows runners) reads "C:\\..." as host:path
    execFileSync("tar", ["-xzf", packed.filename], { cwd: tmp });
    const extracted = path.join(tmp, "package", "bin", `rg${exe}`);
    if (!fs.existsSync(extracted)) {
      throw new Error(`${pkg} does not contain bin/rg${exe}`);
    }

    const binDir = path.join(wrapperDir, "bin");
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.mkdirSync(binDir, { recursive: true });
    const dest = path.join(binDir, `rg${exe}`);
    fs.copyFileSync(extracted, dest);
    if (!exe) fs.chmodSync(dest, 0o755);

    const sha = crypto
      .createHash("sha256")
      .update(fs.readFileSync(dest))
      .digest("hex");
    console.log(
      `[info] ripgrep ${pkg}@${version} -> ${path.relative(projectDir, dest)} (sha256 ${sha.slice(0, 12)})`,
    );
    return dest;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { ripgrepPackageForTarget, installRipgrepBinary };
