const { exec } = require("child_process");
const fs = require("fs");

const args = process.argv.slice(2);
const isPreRelease = args.includes("--pre-release");

if (!fs.existsSync("build")) {
  fs.mkdirSync("build");
}

const command = isPreRelease
  ? "vsce package --out ./build patch --pre-release"
  : "vsce package --out ./build patch";

exec(command, (error) => {
  if (error) throw error;
  console.log("vsce package completed");
});
