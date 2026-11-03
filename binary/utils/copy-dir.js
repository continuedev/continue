// Drop-in replacement for the deprecated `ncp` package: ncp(src, dest, [opts], cb).
// Only the `dereference` option is used by the packaging scripts.
const fs = require("fs");

function ncp(src, dest, opts, cb) {
  if (typeof opts === "function") {
    cb = opts;
    opts = {};
  }
  fs.cp(
    src,
    dest,
    { recursive: true, force: true, dereference: !!(opts && opts.dereference) },
    cb,
  );
}

module.exports = { ncp };
