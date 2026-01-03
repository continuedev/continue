import { ContinueAcpServer } from "../acp/server.js";
import { configureConsoleForHeadless, safeStderr } from "../init.js";
import { logger } from "../util/logger.js";

import { ExtendedCommandOptions } from "./BaseCommandOptions.js";

export async function acp(options: ExtendedCommandOptions = {}) {
  configureConsoleForHeadless(true);
  logger.configureHeadlessMode(true);

  const server = new ContinueAcpServer(options);
  try {
    await server.run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    safeStderr(`ACP server failed: ${message}\n`);
    process.exit(1);
  }
}
