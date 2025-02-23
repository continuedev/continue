const fs = require("fs");

const directories = [
  // gui
  "./gui/node_modules",
  "./gui/out",
  "./gui/dist",
  // core
  "./core/node_modules",
  "./core/dist",
  // extensions/vscode
  "./extensions/vscode/node_modules",
  "./extensions/vscode/bin",
  "./extensions/vscode/build",
  "./extensions/vscode/out",
  // binary
  "./binary/node_modules",
  "./binary/bin",
  "./binary/dist",
  "./binary/out",
  // root
  "./node_modules",
];

directories.forEach((dir) => {
  if (fs.existsSync(dir)) {
    fs.rmdirSync(dir, { recursive: true });
    console.log(`Removed ${dir}`);
  } else {
    console.log(`${dir} not found`);
  }
});
