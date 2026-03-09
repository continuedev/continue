import { execFileSync } from "node:child_process";

const extensionsDir = "./e2e/.test-extensions";
const storageDir = "./e2e/storage";
const remoteExtensions = [
  "ms-vscode-remote.remote-ssh",
  "ms-vscode-remote.remote-containers",
  "ms-vscode-remote.remote-wsl",
];

if (process.env.IGNORE_SSH_TESTS === "true") {
  console.log(
    "Skipping Remote-* marketplace extension installs because IGNORE_SSH_TESTS=true.",
  );
  process.exit(0);
}

const extestCommand = process.platform === "win32" ? "extest.cmd" : "extest";

for (const extensionId of remoteExtensions) {
  console.log(`Installing ${extensionId} from the VS Code marketplace...`);
  execFileSync(
    extestCommand,
    [
      "install-from-marketplace",
      extensionId,
      "--extensions_dir",
      extensionsDir,
      "--storage",
      storageDir,
    ],
    { stdio: "inherit" },
  );
}
