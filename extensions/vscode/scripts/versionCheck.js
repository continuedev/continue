// Make sure odd-numbered version isn't published to main release. This will irreversibly cause us to bump the minor version by 2
const fs = require("fs");

const packageJson = fs.readFileSync("package.json");
const packageJsonJson = JSON.parse(packageJson);
const version = packageJsonJson.version;
const minor = parseInt(version.split(".")[1]);
if (minor % 2 !== 0) {
  throw new Error(
    "Do not publish odd-numbered version to main VS Code release!"
  );
}
