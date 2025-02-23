import fs from "node:fs";
import * as path from "node:path";

import { runTests } from "@vscode/test-electron";
import { defaultConfig } from "core/config/default";

export const testWorkspacePath = path.resolve(
  __dirname,
  "..",
  "src",
  "test",
  "fixtures",
  "test-workspace",
);

const continueGlobalDir = path.resolve(
  __dirname,
  "..",
  "src",
  "test",
  "fixtures",
  ".continue",
);

function setupTestWorkspace() {
  if (fs.existsSync(testWorkspacePath)) {
    fs.rmSync(testWorkspacePath, { recursive: true });
  }
  fs.mkdirSync(testWorkspacePath, {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(testWorkspacePath, "test.py"),
    "print('Hello World!')",
  );
  fs.writeFileSync(
    path.join(testWorkspacePath, "index.js"),
    "console.log('Hello World!')",
  );
  fs.writeFileSync(
    path.join(testWorkspacePath, "test.py"),
    "print('Hello World!')",
  );
  fs.mkdirSync(path.join(testWorkspacePath, "test-folder"));
  fs.writeFileSync(
    path.join(testWorkspacePath, "test-folder", "test.js"),
    "console.log('Hello World!')",
  );
}

function setupContinueGlobalDir() {
  if (fs.existsSync(continueGlobalDir)) {
    fs.rmSync(continueGlobalDir, { recursive: true });
  }
  fs.mkdirSync(continueGlobalDir, {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(continueGlobalDir, "config.json"),
    JSON.stringify({
      ...defaultConfig,
      models: [
        {
          title: "Test Model",
          provider: "openai",
          model: "gpt-3.5-turbo",
          apiKey: "API_KEY",
        },
      ],
    }),
  );
}

function cleanupTestWorkspace() {
  if (fs.existsSync(testWorkspacePath)) {
    fs.rmSync(testWorkspacePath, { recursive: true });
  }
}

function cleanupContinueGlobalDir() {
  if (fs.existsSync(continueGlobalDir)) {
    fs.rmSync(continueGlobalDir, { recursive: true });
  }
}

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

    const extensionTestsEnv = {
      NODE_ENV: "test",
      CONTINUE_GLOBAL_DIR: continueGlobalDir,
    };

    setupTestWorkspace();
    setupContinueGlobalDir();

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv,
      launchArgs: [testWorkspacePath],
    });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  } finally {
    cleanupTestWorkspace();
    cleanupContinueGlobalDir();
  }
}

main();
