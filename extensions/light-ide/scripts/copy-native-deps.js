const path = require("path");
const fs = require("fs");
const { ncp } = require("ncp");
const rimraf = require("rimraf");
const rimrafSync = rimraf.sync;


const log = (msg) => console.log(`[copy-native-deps] ${msg}`);

// Ensure output dir exists
fs.mkdirSync("out", { recursive: true });

// 1. Copy sqlite3 native binding from core to out/build
const sqliteSrc = path.join(__dirname, "../../core/node_modules/sqlite3/build");
const sqliteDest = path.join(__dirname, "out/build");

log("Cleaning old sqlite3 build...");
rimrafSync(sqliteDest);

log("Copying sqlite3 native binding...");
ncp(sqliteSrc, sqliteDest, { dereference: true }, (err) => {
  if (err) {
    console.error("Failed to copy sqlite3 bindings:", err);
    process.exit(1);
  } else {
    log("Copied sqlite3 native module to out/build");
  }
});

// 2. Copy xhr-sync-worker.js from jsdom into out/
const xhrSrc = path.join(__dirname, "../node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js");
const xhrDest = path.join(__dirname, "out/xhr-sync-worker.js");

try {
  fs.copyFileSync(xhrSrc, xhrDest);
  log("Copied xhr-sync-worker.js to out/");
} catch (err) {
  console.error("Failed to copy xhr-sync-worker.js:", err);
  process.exit(1);
}
