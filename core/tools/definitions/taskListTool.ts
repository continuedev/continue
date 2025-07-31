import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskListTool: Tool = {
  type: "function",
  displayTitle: "Task List Manager",
  wouldLikeTo: "manage tasks",
  isCurrently: "managing tasks",
  hasAlready: "managed tasks",
  readonly: false,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskList,
    description: `A comprehensive task management tool for organizing, tracking, and executing work in a structured queue-based system.
This tool helps manage complex workflows by breaking them down into manageable tasks that can be tracked and executed systematically.

When to use this tool:
- Breaking down complex multi-step work into organized tasks
- Planning and tracking progress on development projects
- Managing sequences of related changes across a codebase
- Coordinating multiple tasks that need to be completed in order
- Organizing work that benefits from structured planning and execution
- Tracking completion status of various development activities
- Managing task dependencies and workflow organization

Key features:
- Add new tasks with detailed descriptions and context
- List all current tasks with their status and details
- Update existing tasks with new information or status changes
- Start/execute tasks by marking them in progress

Task management workflow:
1. Use 'add' to create new tasks with clear names and detailed descriptions
2. Use 'list' to view all current tasks and their status
3. Use 'runTask' to begin working on a specific task
4. Use 'update' to modify task details

Best practices:
- Create tasks that represent meaningful units of work
- Use descriptive names that clearly indicate the task purpose
- Include detailed descriptions with context, requirements, and acceptance criteria
- Start tasks manually one by one rather than automatic queue processing

Parameters explained:
- action: The specific operation to perform (add, list, update, run_task)
- name: Short, descriptive task name (required for add/update operations)
- description: Detailed task description with context and requirements (required for add/update)
- task_id: Unique identifier for the task (required for update/remove/run_task operations)

The tool automatically handles task ID generation, status tracking, and GUI updates.
Task IDs are managed internally and should not be exposed to users in normal interactions.`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: ["add", "list", "update", "run_task"],
          description: "The specific action to perform on the task list.",
        },
        name: {
          type: "string",
          description:
            "A short, descriptive name for the task. Required when adding or updating a task. Should clearly indicate the task purpose.",
        },
        description: {
          type: "string",
          description:
            "A detailed description of the task including context, requirements, and acceptance criteria. Required when adding or updating a task.",
        },
        task_id: {
          type: "string",
          description:
            "The unique identifier of the task to operate on. Required when updating or running a specific task. Should not be exposed to users.",
        },
      },
    },
  },
};
