const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const isPreRelease = args.includes("--pre-release");

if (!fs.existsSync("build")) {
  fs.mkdirSync("build");
}

const command = isPreRelease
  ? "npx vsce package --out ./build --pre-release --no-dependencies"
  : "npx vsce package --out ./build --no-dependencies";

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${stderr}`);
    throw error;
  }
  console.log(stdout);

  const vsixFileMatch = stdout.match(/Packaged:\s+(.*\.vsix)/);
  if (!vsixFileMatch || !vsixFileMatch[1]) {
    console.error("Could not determine VSIX file name from vsce output");
    return;
  }
  const vsixFile = vsixFileMatch[1];
  const vsixPath = path.resolve(vsixFile);

  console.log(`VSIX package created: ${vsixPath}`);
});