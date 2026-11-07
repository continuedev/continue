/**
 * Checks that loading the bundled extension does not load a native (.node)
 * module before activation finishes.
 *
 * Windows Smart App Control and other code integrity policies refuse to load
 * unsigned binaries such as node_sqlite3.node. When a module that loads one is
 * imported at the top level, the whole extension fails to activate, so native
 * modules must be loaded only by the features that use them.
 *
 * Loads out/extension.js with every .node load refused and a stub vscode API,
 * runs activate(), and fails if activation hit a refused native load.
 * Activation errors caused by the stub API are expected and ignored.
 *
 * usage: npm run esbuild && node scripts/check-native-modules-deferred.js
 */
const Module = require("module");
const path = require("path");

const BLOCKED = "Native module refused by check-native-modules-deferred";

const attempted = [];
Module._extensions[".node"] = (_module, filename) => {
  attempted.push(path.basename(filename));
  throw new Error(`${BLOCKED}: ${filename}`);
};

// Enough of the vscode API for module initialisation: every property is a
// callable, constructible stub.
const stub = () =>
  new Proxy(function () {}, {
    get: (_target, prop) => (prop === "then" ? undefined : stub()),
    apply: () => stub(),
    construct: () => stub(),
  });
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === "vscode"
    ? "vscode"
    : resolveFilename.call(this, request, ...rest);
};
require.cache.vscode = {
  id: "vscode",
  filename: "vscode",
  loaded: true,
  exports: stub(),
};

const activationErrors = [];
const log = console.log;
console.log = (...args) => {
  // extension.ts logs activation failures instead of throwing them
  if (String(args[0]).includes("Error activating extension")) {
    activationErrors.push(args[1]);
  }
};

(async () => {
  const extension = require(path.join(__dirname, "../out/extension.js"));
  try {
    await extension.activate(stub());
  } catch (e) {
    // The stub API makes activation fail later on; only native loads matter
    activationErrors.push(e);
  }
  console.log = log;

  // Without prepackage (as in CI) the binary is not next to the bundle, and
  // the `bindings` package fails before Node is asked to load it
  const blocked = activationErrors.find((e) => {
    const text = String(e?.stack ?? e);
    return (
      text.includes(BLOCKED) ||
      text.includes("Could not locate the bindings file")
    );
  });
  if (blocked) {
    console.error(
      "Activation fails when native modules cannot be loaded. A native module is imported at the top level:\n",
    );
    console.error(String(blocked.stack).split("\n").slice(0, 40).join("\n"));
    process.exit(1);
  }
  console.log(
    `OK: activation does not depend on native modules (deferred: ${
      [...new Set(attempted)].join(", ") || "none"
    })`,
  );
  process.exit(0);
})().catch((e) => {
  console.log = log;
  console.error(e);
  process.exit(1);
});
