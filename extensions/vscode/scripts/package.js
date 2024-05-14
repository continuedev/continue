const { exec } = require("child_process");
const fs = require("fs");

const args = process.argv.slice(2);
const isPreRelease = args.includes("--pre-release");

if (!fs.existsSync("build")) {
  fs.mkdirSync("build");
}

const command = isPreRelease
  ? "npx vsce package --out ./build patch --pre-release --no-dependencies" // --yarn"
  : "npx vsce package --out ./build patch --no-dependencies"; // --yarn";

exec(command, (error) => {
  if (error) throw error;
  console.log(
    "vsce package completed - extension created at extensions/vscode/build/continue-patch.vsix",
  );
});
