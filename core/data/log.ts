import fs from "fs";

import { getDevDataFilePath } from "../util/paths.js";
import { Core } from "../core.js";
import {
  allDevEventNames,
  DataLogLevel,
  DevDataLogEvent,
  devDataVersionedSchemas,
} from "@continuedev/config-yaml";
import { fetchwithRequestOptions } from "@continuedev/fetch";
import { joinPathsToUri } from "../util/uri.js";
import * as URI from "uri-js";
import { IDE } from "../index.js";

// const localDevDataFileNamesMap: Record<Dev, string> = {
//   //   tokensGenerated: "tokens_generated",
//   //   chat: "chat",
//   //   quickEdit: "quickEdit",
//   autocomplete: "autocomplete",
// };
const DEFAULT_DEV_DATA_LEVEL: DataLogLevel = "all";
export class DataLogger {
  private static instance: DataLogger | null = null;
  core?: Core;
  ide?: IDE;

  // Private constructor to prevent direct class instantiation
  private constructor() {}

  public static getInstance(): DataLogger {
    if (DataLogger.instance === null) {
      DataLogger.instance = new DataLogger();
    }
    return DataLogger.instance;
  }

  async logDevData(event: DevDataLogEvent) {
    // Local logs (always on)
    const filepath: string = getDevDataFilePath(event.schema);
    const jsonLine = JSON.stringify(event.data);
    fs.writeFileSync(filepath, `${jsonLine}\n`, { flag: "a" });

    // Remote logs
    const config = (await this.core?.configHandler.loadConfig())?.config;
    if (config?.data?.length) {
      await Promise.allSettled(
        config.data.map(async (dataConfig) => {
          try {
            const version = dataConfig.version;
            const level = dataConfig.level ?? DEFAULT_DEV_DATA_LEVEL;
            const events = dataConfig.events ?? allDevEventNames;

            const versionSchemas = devDataVersionedSchemas[version];
            if (!versionSchemas) {
              throw new Error(
                `Logging dev data to version ${version} is not supported.`,
              );
            }

            const uriComponents = URI.parse(dataConfig.destination);
            if (
              uriComponents.scheme === "https" ||
              uriComponents.scheme === "http"
            ) {
              // Send to remote server

              const headers: Record<string, string> = {
                "Content-Type": "application/json",
              };
              if (dataConfig.apiKey) {
                headers["Authorization"] = `Bearer ${dataConfig.apiKey}`;
              }
              const response = await fetchwithRequestOptions(
                dataConfig.destination,
                {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    schema: event.schema,
                    version: dataConfig.version,
                    data: event.data,
                    // x: dataConfig.
                  }),
                },
                dataConfig.requestOptions,
              );
              if (!response.ok) {
                console.error(
                  `Failed to log data to ${dataConfig.destination}: ${response.statusText}`,
                );
              }
            } else {
              joinPathsToUri(dataConfig.destination, "version");
            }
            // Write to jsonc file using IDE
          } catch (error) {
            console.error(
              `Error logging data to ${dataConfig.destination}: ${error instanceof Error ? error.message : error}`,
            );
          }
        }),
      );
    }
  }
}
