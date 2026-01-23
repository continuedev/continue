import type { Tool } from "./types.js";

function getWorkflowIdFromEnv(): string | undefined {
  return process.env.WORKFLOW_ID;
}

export const workflowNotepadTool: Tool = {
  name: "WorkflowNotepad",
  displayName: "Workflow Notepad",
  description:
    "Update your persistent notepad for this workflow. The current notepad content is already visible in your system prompt under <context name='workflowNotepad'>. Use this tool to replace the notepad with new content.",
  parameters: {
    type: "object",
    required: ["content"],
    properties: {
      content: {
        type: "string",
        description:
          "New content to write to notepad (max 100KB). This will replace the entire notepad.",
      },
    },
  },
  readonly: false,
  isBuiltIn: true,
  run: async (args: { content: string }) => {
    const workflowId = getWorkflowIdFromEnv();
    if (!workflowId) {
      throw new Error(
        "Workflow notepad only available when running in a workflow",
      );
    }

    if (!args.content) {
      throw new Error("content is required");
    }

    // Import dynamically to avoid circular dependencies
    const { put } = await import("../util/apiClient.js");

    // PUT /workflows/:workflowId/notepad
    await put(`workflows/${workflowId}/notepad`, {
      notepad: args.content,
    });

    return "Notepad updated successfully. Note: The updated content will be visible in the system prompt when you restart or in your next workflow run.";
  },
};
