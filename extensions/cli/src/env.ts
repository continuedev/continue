import * as os from "os";
import * as path from "path";

import dotenv from "dotenv";

dotenv.config();

export const env = {
  apiBase: process.env.SHADOW_CODE_API_BASE ?? "https://api.continue.dev/",
  continueHome:
    process.env.SHADOW_CODE_GLOBAL_DIR ||
    path.join(os.homedir(), ".shadow-code"),
};
