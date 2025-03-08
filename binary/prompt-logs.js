const fs = require('fs');
const path = require('path');

const logDirPath = path.join(__dirname, '..', 'extensions', '.continue-debug', 'logs');
const logFilePath = path.join(logDirPath, "prompt.log");

if (!fs.existsSync(logDirPath)) {
  fs.mkdirSync(logDirPath, { recursive: true });
}

if (!fs.existsSync(logFilePath)) {
  fs.createWriteStream(logFilePath).end();
}

console.log("Watching logs at " + logFilePath)

fs.watch(logFilePath, () => {
  // console.clear();
  fs.createReadStream(logFilePath).pipe(process.stdout);
});