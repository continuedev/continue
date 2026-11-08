import { getGlobalDirPath } from "core/util/paths.js";
import dotenv from "dotenv";

dotenv.config();

export const env = {
  apiBase: process.env.CONTINUE_API_BASE ?? "https://api.continue.dev/",
  /**
   * The global folder, shared with the VS Code extension: ~/.continuous
   * (copied once from ~/.continue), or CONTINUOUS_GLOBAL_DIR /
   * CONTINUE_GLOBAL_DIR. Resolved by core so both agree.
   */
  continueHome: getGlobalDirPath(),
};
