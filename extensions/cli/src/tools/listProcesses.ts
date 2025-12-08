import type { BackgroundProcessService } from "../services/BackgroundProcessService.js";

import { Tool } from "./types.js";

export const listProcessesTool: Tool = {
  name: "ListProcesses",
  displayName: "List Processes",
  description: "List all background processes and their status.",
  parameters: {
    type: "object",
    properties: {},
  },
  readonly: true,
  isBuiltIn: true,
  run: async (): Promise<string> => {
    const { serviceContainer, SERVICE_NAMES } = await import(
      "../services/index.js"
    );
    const service = await serviceContainer.get<BackgroundProcessService>(
      SERVICE_NAMES.BACKGROUND_PROCESSES,
    );

    const processes = service.listProcesses();

    if (processes.length === 0) {
      return "No background processes running.";
    }

    let result = `Background Processes (${processes.length}):\n\n`;

    for (const proc of processes) {
      const runtime =
        proc.status === "running"
          ? Math.floor((Date.now() - proc.startTime) / 1000)
          : Math.floor((proc.exitTime! - proc.startTime) / 1000);

      result += `[${proc.id}] ${proc.command}\n`;
      result += `    Status: ${proc.status}`;

      if (proc.status === "exited") {
        result += ` (exit code: ${proc.exitCode})`;
      } else if (proc.pid) {
        result += ` (PID: ${proc.pid})`;
      }

      result += `\n    Runtime: ${runtime}s\n`;
      result += `    Started: ${new Date(proc.startTime).toISOString()}\n`;

      if (proc.status === "exited" && proc.exitTime) {
        result += `    Exited: ${new Date(proc.exitTime).toISOString()}\n`;
      }

      result += `\n`;
    }

    return result;
  },
};
