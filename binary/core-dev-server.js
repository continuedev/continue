const path = require("path");
process.env.CONTINUE_DEVELOPMENT = true;

process.env.YUTOAGENTIC_GLOBAL_DIR = path.join(
  process.env.PROJECT_DIR,
  "extensions",
  ".yutoagentic-debug",
);

require("./out/index.js");
