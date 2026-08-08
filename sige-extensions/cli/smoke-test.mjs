#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors for output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
  process.stdout.write(`Testing ${name}... `);
  try {
    testFn();
    console.log(`${colors.green}✓${colors.reset}`);
    testsPassed++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.error(`  Error: ${error.message}`);
    testsFailed++;
  }
}

function execCommand(command, options = {}) {
  return execSync(command, {
    cwd: __dirname,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
}

console.log("🧪 Running smoke tests for bundled CLI...\n");

// Test 1: Check if bundle exists
runTest("Bundle file exists", () => {
  if (!existsSync(resolve(__dirname, "dist/index.js"))) {
    throw new Error("dist/index.js not found");
  }
  if (!existsSync(resolve(__dirname, "dist/cn.js"))) {
    throw new Error("dist/cn.js not found");
  }
});

// Test 2: Check if wrapper script is executable
runTest("Wrapper script has shebang", () => {
  const content = readFileSync(resolve(__dirname, "dist/cn.js"), "utf8");
  if (!content.startsWith("#!/usr/bin/env node")) {
    throw new Error("Wrapper script missing shebang");
  }
});

// Cross-platform command execution helper
function getCLICommand(args = "") {
  const isWindows = process.platform === "win32";
  if (isWindows) {
    return `node dist/cn.js ${args}`;
  } else {
    return `./dist/cn.js ${args}`;
  }
}

// Test 3: Version command works
runTest("Version command", () => {
  const output = execCommand(getCLICommand("--version"));
  const packageJson = JSON.parse(
    readFileSync(resolve(__dirname, "package.json"), "utf8"),
  );
  if (!output.includes(packageJson.version)) {
    throw new Error(
      `Version mismatch. Expected ${packageJson.version}, got: ${output}`,
    );
  }
});

// Test 4: Help command works
runTest("Help command", () => {
  const output = execCommand(getCLICommand("--help"));
  if (!output.includes("Continue CLI") || !output.includes("--version")) {
    throw new Error("Help output missing expected content");
  }
});

// Test 5: Check bundle size
runTest("Bundle size is reasonable", () => {
  const isWindows = process.platform === "win32";
  const command = isWindows
    ? `powershell -Command "(Get-Item dist/index.js).length / 1MB"`
    : `ls -lh dist/index.js`;

  let sizeInMB;

  if (isWindows) {
    try {
      const output = execCommand(command);
      sizeInMB = parseFloat(output.trim());
    } catch {
      // Fallback for Windows if PowerShell fails
      const stats = readFileSync(resolve(__dirname, "dist/index.js"));
      sizeInMB = stats.length / (1024 * 1024);
    }
  } else {
    const stats = execCommand(command);
    const sizeMatch = stats.match(/(\d+(?:\.\d+)?[MK])/);
    if (sizeMatch) {
      const size = sizeMatch[1];
      const numSize = parseFloat(size);
      const unit = size.slice(-1);
      sizeInMB = unit === "M" ? numSize : numSize / 1024;
    }
  }

  console.log(`(${sizeInMB.toFixed(1)}M)`);

  // This is arbitrary. We might go over at some point,
  // in which case you can just increase this.
  if (sizeInMB > 20) {
    throw new Error(`Bundle too large: ${sizeInMB.toFixed(1)}M`);
  }
});

// Test 6: Check that local packages are bundled
runTest("Local packages are bundled", () => {
  const bundleContent = readFileSync(
    resolve(__dirname, "dist/index.js"),
    "utf8",
  );

  // Check for code from @continuedev/config-yaml
  if (
    !bundleContent.includes("AssistantUnrolled") &&
    !bundleContent.includes("config-yaml")
  ) {
    throw new Error("@continuedev/config-yaml not properly bundled");
  }

  // Check for code from @continuedev/openai-adapters
  // Since the bundle is minified, check for strings that would be present
  // even after minification (e.g., error messages, property names)
  if (
    !bundleContent.includes("anthropic") &&
    !bundleContent.includes("gemini") &&
    !bundleContent.includes("openai") &&
    !bundleContent.includes("azure") &&
    !bundleContent.includes("bedrock")
  ) {
    throw new Error("@continuedev/openai-adapters not properly bundled");
  }
});

// Test 7: Test that the CLI can be invoked programmatically
runTest("CLI can be invoked", () => {
  try {
    // Test that the CLI runs without crashing when given no args
    const isWindows = process.platform === "win32";
    const nullDevice = isWindows ? "nul" : "/dev/null";
    execCommand(`${getCLICommand("--help")} > ${nullDevice} 2>&1`);
  } catch (error) {
    throw new Error(`CLI invocation failed: ${error.message}`);
  }
});

// Test 8: Check metadata file
runTest("Build metadata exists", () => {
  if (!existsSync(resolve(__dirname, "dist/meta.json"))) {
    throw new Error("dist/meta.json not found");
  }

  const meta = JSON.parse(
    readFileSync(resolve(__dirname, "dist/meta.json"), "utf8"),
  );
  if (!meta.inputs || !meta.outputs) {
    throw new Error("Invalid metadata structure");
  }
});

// Test 9: Verify no missing external dependencies
runTest("No missing runtime dependencies", () => {
  // This would fail in Test 3 if dependencies were missing, but let's be explicit
  const output = execCommand(`${getCLICommand("--version")} 2>&1`, {
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (
    output.includes("Cannot find module") ||
    output.includes("MODULE_NOT_FOUND")
  ) {
    throw new Error("Missing module detected in output");
  }
});

// Test 10: Test npm link scenario
runTest("CLI works via npm link", () => {
  try {
    // Simply test that we can execute with node directly
    const output = execCommand("node dist/cn.js --version 2>&1");
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "package.json"), "utf8"),
    );
    if (!output.includes(packageJson.version)) {
      throw new Error("Version not found when running via node");
    }
  } catch (error) {
    throw new Error(`npm link scenario failed: ${error.message}`);
  }
});

// Summary
console.log("\n" + "=".repeat(50));
if (testsFailed === 0) {
  console.log(
    `${colors.green}✅ All ${testsPassed} tests passed!${colors.reset}`,
  );
  process.exit(0);
} else {
  console.log(
    `${colors.red}❌ ${testsFailed} test(s) failed, ${testsPassed} passed${colors.reset}`,
  );
  process.exit(1);
}
