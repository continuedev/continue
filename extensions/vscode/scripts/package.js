const { spawn } = require("child_process");
const fs = require("fs");

const pkg = JSON.parse(
  fs.readFileSync("./package.json", { encoding: "utf-8" }),
);
const version = pkg.version;

// Auto-update displayName with current version for custom builds
const customDisplayName = `Continue OnPrem — AI code agent (custom v${version})`;
if (pkg.displayName !== customDisplayName) {
  pkg.displayName = customDisplayName;
  fs.writeFileSync("./package.json", JSON.stringify(pkg, null, 2) + "\n");
  console.log(`[custom] Updated displayName → "${customDisplayName}"`);
}

const args = process.argv.slice(2);
let target;

if (args[0] === "--target") {
  target = args[1];
}

if (!fs.existsSync("build")) {
  fs.mkdirSync("build");
}

const isPreRelease = args.includes("--pre-release");

const vscePath = require.resolve("@vscode/vsce/out/main");
let command = isPreRelease
  ? `node "${vscePath}" package --out ./build --pre-release --no-dependencies`
  : `node "${vscePath}" package --out ./build --no-dependencies`;

if (target) {
  command += ` --target ${target}`;
}

const parts = command.split(" ");
const childCmd = parts[0];
const childArgs = parts.slice(1);
const child = spawn(childCmd, childArgs, { stdio: "inherit", shell: true });
child.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code);
  }
  console.log(
    `vsce package completed - extension created at extensions/vscode/build/continue-${version}.vsix`,
  );
});
