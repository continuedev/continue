import { sentryService } from "../sentry.js";
import { telemetryService } from "../telemetry/telemetryService.js";

import { logger } from "./logger.js";

/**
 * Exit the process after flushing telemetry and error reporting.
 * Use this instead of process.exit() to avoid losing metrics/logs.
 */
export async function gracefulExit(code: number = 0): Promise<void> {
  try {
    // Flush metrics (forceFlush + shutdown inside service)
    await telemetryService.shutdown();
  } catch (err) {
    logger.debug("Telemetry shutdown error (ignored)", err as any);
  }

  try {
    // Flush Sentry (best effort)
    await sentryService.flush();
  } catch (err) {
    logger.debug("Sentry flush error (ignored)", err as any);
  }

  // Exit the process
  process.exit(code);
}
