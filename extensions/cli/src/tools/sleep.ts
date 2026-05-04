/**
 * SleepTool — pause execution for a specified duration.
 *
 * Ported from Marcel's SleepTool concept for the Continue CLI.
 * Useful in agent workflows for rate limiting, polling loops,
 * waiting for background processes, or pacing sequential operations.
 */

import { Tool } from "./types.js";

const MAX_SLEEP_SECONDS = 60;

export const sleepTool: Tool = {
  name: "Sleep",
  displayName: "Sleep",
  description:
    "Pause execution for a specified number of seconds (max 60). Useful for waiting between retries, rate-limited APIs, or pacing sequential operations in agent workflows.",
  parameters: {
    type: "object",
    required: ["seconds"],
    properties: {
      seconds: {
        type: "number",
        description: `Number of seconds to sleep (0.1–${MAX_SLEEP_SECONDS})`,
      },
      reason: {
        type: "string",
        description: "Optional reason for sleeping (shown in progress display)",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    const secs = Math.min(
      Math.max(Number(args.seconds) || 1, 0.1),
      MAX_SLEEP_SECONDS,
    );
    return {
      preview: [
        {
          type: "text",
          content: `Sleeping for ${secs}s${args.reason ? `: ${args.reason}` : ""}`,
        },
      ],
      args: { ...args, seconds: secs },
    };
  },
  run: async (args: { seconds: number; reason?: string }): Promise<string> => {
    const raw = Number(args.seconds);
    if (isNaN(raw) || raw <= 0) {
      return "Error: seconds must be a positive number";
    }

    const secs = Math.min(Math.max(raw, 0.1), MAX_SLEEP_SECONDS);
    const ms = Math.round(secs * 1000);

    await new Promise<void>((resolve) => setTimeout(resolve, ms));

    const actual = secs === raw ? secs : secs;
    const clamped = raw !== actual;

    return `Slept for ${secs}s${clamped ? ` (clamped from ${raw}s)` : ""}${args.reason ? `. Reason: ${args.reason}` : ""}.`;
  },
};
