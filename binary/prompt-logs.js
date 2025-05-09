const fs = require('fs');
const path = require('path');

const logDirPath = path.join(__dirname, '..', 'extensions', '.continue-debug', 'logs');
const logFilePath = path.join(logDirPath, "prompt.log");

// Ensure the log directory exists
if (!fs.existsSync(logDirPath)) {
  fs.mkdirSync(logDirPath, { recursive: true });
  console.log("Created log directory at " + logDirPath);
}

// Create the log file if it doesn't exist
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, ''); // Create an empty file synchronously
  console.log("Created empty log file at " + logFilePath);
}

console.log("Watching logs at " + logFilePath);

// Set up the file watcher
try {
  fs.watch(logFilePath, () => {
    try {
      // console.clear();
      const stream = fs.createReadStream(logFilePath);
      stream.pipe(process.stdout);
      stream.on('error', (err) => {
        console.error('Error reading log file:', err.message);
      });
    } catch (err) {
      console.error('Error while handling file change:', err.message);
    }
  });
} catch (err) {
  console.error('Error setting up file watcher:', err.message);
  console.log('You may need to restart the script after the extension generates the first log entry.');
}