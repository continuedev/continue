const path = require("path");
process.env.SHADOW_CODE_DEVELOPMENT = true;

process.env.SHADOW_CODE_GLOBAL_DIR = path.join(
  process.env.PROJECT_DIR,
  "extensions",
  ".shadow-code-debug",
);

require("./out/index.js");
