const { execSync } = require("child_process");

const PLATFORMS = [
  "win32-x64",
  //   "win32-arm64", can't be built due to no sqlite3 binaries
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
];
const args = process.argv.slice(2);
const isPreRelease = args.includes("--pre-release");

void (async () => {
  for (const i in PLATFORMS) {
    const platform = PLATFORMS[i];
    const pkgCommand = isPreRelease
      ? "node scripts/package.js --pre-release --target " + platform // --yarn"
      : "node scripts/package.js --target " + platform; // --yarn";

    execSync("node scripts/prepackage-cross-platform.js --target " + platform, {
      stdio: "inherit",
    });
    execSync(pkgCommand, { stdio: "inherit" });
  }
  process.exit(0);
})();
