import type { BackgroundProcessService } from "../services/BackgroundProcessService.js";

import { Tool } from "./types.js";

export const killProcessTool: Tool = {
  name: "KillProcess",
  displayName: "Kill Process",
  description: `Terminate a background process by ID.

Use this to stop dev servers, cancel long-running builds, or clean up test processes when you're done with them. The process will be killed immediately (SIGTERM).`,
  parameters: {
    type: "object",
    required: ["bash_id"],
    properties: {
      bash_id: {
        type: "number",
        description: "Process ID to terminate",
      },
    },
  },
  readonly: false,
  isBuiltIn: true,
  run: async ({ bash_id }: { bash_id: number }): Promise<string> => {
    const { serviceContainer, SERVICE_NAMES } = await import(
      "../services/index.js"
    );
    const service = await serviceContainer.get<BackgroundProcessService>(
      SERVICE_NAMES.BACKGROUND_PROCESSES,
    );

    const result = await service.killProcess(bash_id);
    return result.message;
  },
};
