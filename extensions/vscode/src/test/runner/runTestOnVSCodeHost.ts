import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`

    // Assumes this file is in out/runTestOnVSCodeHost.js
    const extensionDevelopmentPath = path.resolve(__dirname, "../");
    console.log("extensionDevelopmentPath", extensionDevelopmentPath);

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(
      extensionDevelopmentPath,
      "out/mochaRunner",
    );

    const extensionTestsEnv = {};

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv,
    });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

main();
