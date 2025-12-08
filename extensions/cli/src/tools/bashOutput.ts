import type { BackgroundProcessService } from "../services/BackgroundProcessService.js";

import { Tool } from "./types.js";

export const bashOutputTool: Tool = {
  name: "BashOutput",
  displayName: "Bash Output",
  description:
    "Read output from a background process started with Bash tool's run_in_background parameter. Returns new output since last read.",
  parameters: {
    type: "object",
    required: ["bash_id"],
    properties: {
      bash_id: {
        type: "number",
        description: "Process ID returned when starting the background command",
      },
      filter: {
        type: "string",
        description:
          "Optional regex pattern - only return lines matching this pattern",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async ({
    bash_id,
    filter,
  }: {
    bash_id: number;
    filter?: string;
  }): Promise<string> => {
    const { serviceContainer, SERVICE_NAMES } = await import(
      "../services/index.js"
    );
    const service = await serviceContainer.get<BackgroundProcessService>(
      SERVICE_NAMES.BACKGROUND_PROCESSES,
    );

    const process = service.getProcess(bash_id);
    if (!process) {
      return `Error: No background process found with ID ${bash_id}. Use ListProcesses to see running processes.`;
    }

    const output = service.readOutput(bash_id);
    if (!output) {
      return `Error: Failed to read output from process ${bash_id}.`;
    }

    // Apply filter if provided
    let stdout = output.stdout;
    let stderr = output.stderr;

    if (filter) {
      try {
        const regex = new RegExp(filter);
        stdout = stdout.filter((line) => regex.test(line));
        stderr = stderr.filter((line) => regex.test(line));
      } catch {
        return `Error: Invalid regex pattern: ${filter}`;
      }
    }

    // Format output
    let result = `Process ${bash_id} (${process.status})`;
    if (process.status === "exited") {
      result += ` - exit code: ${output.exitCode}`;
    } else if (process.pid) {
      result += ` - PID: ${process.pid}`;
    }
    result += `\n\n`;

    if (stdout.length > 0) {
      result += `STDOUT:\n${stdout.join("\n")}\n\n`;
    }

    if (stderr.length > 0) {
      result += `STDERR:\n${stderr.join("\n")}\n`;
    }

    if (stdout.length === 0 && stderr.length === 0) {
      result += "(no new output)";
    }

    return result;
  },
};
