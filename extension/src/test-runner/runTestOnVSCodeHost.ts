import { runTests } from "@vscode/test-electron";
import * as path from "path";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`

    // Assumes this file is in out/test-runner/runTestOnVSCodeHost.js
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(
      extensionDevelopmentPath,
      "out/test-runner/mochaRunner"
    );

    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

main();
