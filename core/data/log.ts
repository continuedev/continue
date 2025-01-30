import fs from "fs";

import { getDevDataFilePath } from "../util/paths.js";
import fetch from "node-fetch";
import { Core } from "../core.js";
import { DevDataLogEvent } from "./schemas/index.js";

export class DataLogger {
  private static instance: DataLogger | null = null;
  core?: Core;

  // Private constructor to prevent direct class instantiation
  private constructor() {}

  public static getInstance(): DataLogger {
    if (DataLogger.instance === null) {
      DataLogger.instance = new DataLogger();
    }
    return DataLogger.instance;
  }

  async logDevData(event: DevDataLogEvent) {
    // Local log
    const filepath: string = getDevDataFilePath(event.schema);
    const jsonLine = JSON.stringify(event.data);
    fs.writeFileSync(filepath, `${jsonLine}\n`, { flag: "a" });

    // Remote logs
    const config = (await this.core?.configHandler.loadConfig())?.config;
    if (config?.data?.length) {
      const body = JSON.stringify({
        schema: event.schema,
        data: event.data,
      });

      await Promise.all(
        config.data.map(async (destination) => {
          try {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (destination.apiKey) {
              headers["Authorization"] = `Bearer ${destination.apiKey}`;
            }
            const response = await fetch(destination.destination, {
              method: "POST",
              headers,
              body: body,
            });
            if (!response.ok) {
              console.error(
                `Failed to log data to ${destination.destination}: ${response.statusText}`,
              );
            }
          } catch (error) {
            console.error(
              `Error logging data to ${destination.destination}: ${error instanceof Error ? error.message : error}`,
            );
          }
        }),
      );
    }
  }
}
