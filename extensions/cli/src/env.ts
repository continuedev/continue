import * as os from "os";
import * as path from "path";

import dotenv from "dotenv";

dotenv.config();

export const env = {
  apiBase: process.env.CONTINUE_API_BASE ?? "https://api.yutoagentic.dev/",
  workOsClientId:
    process.env.WORKOS_CLIENT_ID ?? "client_01J0FW6XN8N2XJAECF7NE0Y65J",
  appUrl: process.env.HUB_URL || "https://yutoagentic.dev",
  continueHome:
    process.env.YUTOAGENTIC_GLOBAL_DIR ||
    path.join(os.homedir(), ".yutoagentic"),
};
