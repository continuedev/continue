const fs = require("fs");
const path = require("path");

const directories = ["./gui", "./core", "./extensions/vscode", "./binary"];

directories.forEach((dir) => {
  const nodeModulesPath = path.join(dir, "node_modules");

  if (fs.existsSync(nodeModulesPath)) {
    fs.rmdirSync(nodeModulesPath, { recursive: true });
    console.log(`Removed ${nodeModulesPath}`);
  } else {
    console.log(`No node_modules found in ${dir}`);
  }
});
