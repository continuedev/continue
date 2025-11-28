import * as path from "path";

import { env } from "../env.js";

export const AUTH_CONFIG_PATH = path.join(env.continueHome, "auth.json");
