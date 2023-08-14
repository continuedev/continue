const { exec } = require("child_process");
const fs = require("fs");

if (!fs.existsSync("build")) {
  fs.mkdirSync("build");
}

exec("vsce package --out ./build patch", (error) => {
  if (error) throw error;
  console.log("vsce package completed");
});
