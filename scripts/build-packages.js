const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");

const npmInstallCmd = process.env.CI === "true" ? "npm ci" : "npm install";

function runCommand(command, cwd, packageName) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ${packageName}: ${command}`);

    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${packageName}: ${command} completed successfully`);
        resolve({ packageName, command });
      } else {
        console.error(`❌ ${packageName}: ${command} failed with code ${code}`);
        reject(
          new Error(`${packageName} failed: ${command} (exit code ${code})`),
        );
      }
    });

    child.on("error", (error) => {
      console.error(`❌ ${packageName}: Failed to start ${command}:`, error);
      reject(error);
    });
  });
}

// Helper function to build a package (install + build)
async function buildPackage(packageName, cleanNodeModules = false) {
  const packagePath = path.join(__dirname, "..", "packages", packageName);

  if (!fs.existsSync(packagePath)) {
    throw new Error(`Package directory not found: ${packagePath}`);
  }

  if (cleanNodeModules) {
    const nodeModulesPath = path.join(packagePath, "node_modules");
    if (fs.existsSync(nodeModulesPath)) {
      console.log(`🧹 Cleaning node_modules for ${packageName}`);
      await fsPromises.rm(nodeModulesPath, { recursive: true, force: true });
    }
  }

  await runCommand(npmInstallCmd, packagePath, `${packageName} (install)`);

  return runCommand("npm run build", packagePath, `${packageName} (build)`);
}

async function buildPackagesInParallel(packages, cleanNodeModules = false) {
  const buildPromises = packages.map((pkg) =>
    buildPackage(pkg, cleanNodeModules),
  );
  return Promise.all(buildPromises);
}

async function main() {
  try {
    console.log("🚀 Starting package builds...\n");

    // Phase 1: Build foundation packages (no local dependencies)
    await buildPackagesInParallel(["config-types", "terminal-security"]);

    // Phase 2: Build packages that depend on config-types
    await buildPackagesInParallel(["fetch", "config-yaml", "llm-info"]);

    // Phase 3: Build packages that depend on other local packages
    await buildPackagesInParallel(["openai-adapters", "yutoagentic-sdk"]);

    console.log("🎉 All packages built successfully!");
  } catch (error) {
    console.error("💥 Build failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
