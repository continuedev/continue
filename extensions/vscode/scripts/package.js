const { exec } = require("child_process");
const fs = require("fs");

const version = JSON.parse(
  fs.readFileSync("./package.json", { encoding: "utf-8" }),
).version;

const args = process.argv.slice(2);
let target;

if (args[0] === "--target") {
  target = args[1];
}

if (!fs.existsSync("build")) {
  fs.mkdirSync("build");
}

const isPreRelease = args.includes("--pre-release");

let command = isPreRelease
  ? "npx @vscode/vsce package --out ./build --pre-release --no-dependencies" // --yarn"
  : "npx @vscode/vsce package --out ./build --no-dependencies"; // --yarn";

if (target) {
  command += ` --target ${target}`;
}

exec(command, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
  if (error) {
    // exec keeps vsce's own output; without this a failure shows only
    // "Command failed" and not why.
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    throw error;
  }
  console.log(
    `vsce package completed - extension created at extensions/vscode/build/continued-${version}.vsix`,
  );
});
