import * as fs from "fs";
import * as path from "path";

import { logger } from "./logger.js";

/**
 * Set to a directory, makes the CLI write every outgoing chat request body
 * (OpenAI format, as handed to the provider adapter, before sending) to a
 * timestamped JSON file there, so the prefixes of two sessions can be diffed
 * when a prompt cache misses. Keys that look like credentials are redacted.
 */
export const REQUEST_DUMP_ENV = "CONTINUE_DUMP_REQUESTS";

/** `apiKey`, `x-api-key`, `authorization`, `access_token`; not `max_tokens`. */
const SECRET_KEY =
  /(api[_-]?key|secret|password|credential|authorization|(^|[_-])token$)/i;

let sequence = 0;
let warned = false;

export function redactRequest(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactRequest);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as object)) {
      out[key] =
        SECRET_KEY.test(key) && inner !== null && typeof inner !== "object"
          ? "[redacted]"
          : redactRequest(inner);
    }
    return out;
  }
  return value;
}

/**
 * Write one request body to the dump directory. Returns the file written, or
 * undefined when dumping is off or the write failed (logged once).
 */
export function dumpRequest(
  body: unknown,
  directory: string | undefined = process.env[REQUEST_DUMP_ENV],
): string | undefined {
  if (!directory) return undefined;
  try {
    fs.mkdirSync(directory, { recursive: true });
    sequence += 1;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(
      directory,
      `request-${stamp}-${String(sequence).padStart(3, "0")}.json`,
    );
    fs.writeFileSync(file, JSON.stringify(redactRequest(body), null, 2));
    return file;
  } catch (error) {
    if (!warned) {
      warned = true;
      logger.warn(`Could not write the request dump to ${directory}`, error);
    }
    return undefined;
  }
}
