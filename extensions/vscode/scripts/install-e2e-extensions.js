/**
 * Installs the marketplace extensions the e2e tests need.
 *
 * `extest install-from-marketplace` passes --force, so every e2e job
 * downloaded all three again even when the CI cache had restored them, and
 * one dropped connection (read ECONNRESET) failed the job before any test
 * ran. This skips an extension that is already in the extensions folder and
 * retries a download that fails.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXTENSIONS = [
  "ms-vscode-remote.remote-ssh",
  "ms-vscode-remote.remote-containers",
  "ms-vscode-remote.remote-wsl",
];
const EXTENSIONS_DIR = "./e2e/.test-extensions";
const STORAGE = "./e2e/storage";
const ATTEMPTS = 3;

function isInstalled(id) {
  if (!fs.existsSync(EXTENSIONS_DIR)) return false;
  const prefix = `${id.toLowerCase()}-`;
  return fs.readdirSync(EXTENSIONS_DIR).some((entry) => {
    if (!entry.toLowerCase().startsWith(prefix)) return false;
    return fs.existsSync(path.join(EXTENSIONS_DIR, entry, "package.json"));
  });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

for (const id of EXTENSIONS) {
  if (isInstalled(id)) {
    console.log(`${id} is already installed`);
    continue;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync(
        "npx",
        [
          "extest",
          "install-from-marketplace",
          id,
          "--extensions_dir",
          EXTENSIONS_DIR,
          "--storage",
          STORAGE,
        ],
        { stdio: "inherit" },
      );
      break;
    } catch (e) {
      if (attempt >= ATTEMPTS) throw e;
      const wait = 5000 * attempt;
      console.warn(
        `Installing ${id} failed (attempt ${attempt}/${ATTEMPTS}); retrying in ${wait / 1000}s`,
      );
      sleep(wait);
    }
  }
}
