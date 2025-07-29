const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const npmInstallCmd = process.env.CI === "true" ? "npm ci" : "npm install";

function runCommand(command, cwd, packageName) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ${packageName}: ${command}`);

    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, {
      cwd,
      stdio: "pipe",
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${packageName}: ${command} completed successfully`);
        resolve({ packageName, command, stdout, stderr });
      } else {
        console.error(`❌ ${packageName}: ${command} failed with code ${code}`);
        console.error(`stderr: ${stderr}`);
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

async function buildPackage(packageName) {
  const packagePath = path.join(__dirname, "..", "packages", packageName);

  if (!fs.existsSync(packagePath)) {
    throw new Error(`Package directory not found: ${packagePath}`);
  }

  await runCommand(npmInstallCmd, packagePath, `${packageName} (install)`);

  return runCommand("npm run build", packagePath, `${packageName} (build)`);
}

async function main() {
  try {
    console.log("🚀 Starting package builds...");

    await Promise.all([
      buildPackage("openai-adapters"),
      buildPackage("config-yaml"),
    ]);

    console.log("🎉 All packages built successfully!");
  } catch (error) {
    console.error("💥 Build failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
