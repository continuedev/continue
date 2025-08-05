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
    description: `A task management tool for organizing and tracking work.
Helps break down complex workflows into manageable tasks that can be tracked systematically.

Operations:
- add: Create new tasks with names and descriptions
- list: View all tasks and their status
- update: Modify existing task details
- run_task: Begin working on a specific task

Best practices:
- Create meaningful units of work
- Use descriptive names
- Include detailed descriptions with requirements
- Execute tasks one at a time

Parameters:
- action: Operation to perform (add/list/update/run_task)
- name: Task name (for add/update)
- description: Task details and requirements (for add/update)
- task_id: Internal identifier (for update/run_task)

Task IDs and status tracking are managed automatically.`,
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
