import { getCoreLogsPath } from "core/util/paths";
import fs from "node:fs";

export function setupCoreLogging() {
  const logger = (message: any, ...optionalParams: any[]) => {
    const logFilePath = getCoreLogsPath();
    const timestamp = new Date().toISOString().split(".")[0];
    const logMessage = `[${timestamp}] ${message} ${optionalParams.join(" ")}\n`;
    fs.appendFileSync(logFilePath, logMessage);
  };
  console.log = logger;
  console.error = logger;
  console.warn = logger;
  console.debug = logger;
  console.log("[info] Starting Continue core...");
}
