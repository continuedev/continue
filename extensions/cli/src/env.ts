import * as os from "os";
import * as path from "path";

import dotenv from "dotenv";

dotenv.config();

export const env = {
  apiBase: process.env.CONTINUE_API_BASE ?? "https://api.continue.dev/",
<<<<<<< HEAD
  workOsClientId:
    process.env.WORKOS_CLIENT_ID ?? "client_01J0FW6XN8N2XJAECF7NE0Y65J",
  appUrl: process.env.HUB_URL || "https://continue.dev",
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  continueHome:
    process.env.CONTINUE_GLOBAL_DIR || path.join(os.homedir(), ".continue"),
};
