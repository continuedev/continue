import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getSessionTaskManager } from "../../context/taskList";
import { TaskStatus } from "../../context/taskList/TaskManager";

export const taskListImpl: ToolImpl = async (args, extras) => {
  let contextItem: ContextItem;
  const manager = await getSessionTaskManager(extras.messenger!);

  const { action } = args;

  switch (action) {
    case "add": {
      const taskId = manager.add(args.name, args.description);
      contextItem = {
        name: "Add task",
        description: "Task was added to the queue",
        content: `Task added with ID: ${taskId}`,
      };
      break;
    }
    case "update": {
      manager.update(args.task_id, args.name, args.description);
      contextItem = {
        name: "Update task",
        description: "Task was updated",
        content: `Task updated with ID: ${args.task_id}`,
      };
      break;
    }
    case "list": {
      const tasks = manager.list();
      contextItem = {
        name: "List tasks",
        description: "Current task list",
        content: JSON.stringify(tasks, null, 2),
      };
      break;
    }
    case "run_task": {
      const task = manager.getTaskById(args.task_id);
      manager.setTaskStatus(task.task_id, TaskStatus.Completed);
      contextItem = {
        name: "Run task",
        description: "Perform the following task operation",
        content: JSON.stringify(task, null, 2),
      };
      break;
    }
    default: {
      throw new Error(
        `Unknown task action: ${action}. Valid actions are: add, list, update, remove, start, clear`,
      );
    }
  }

  return [contextItem];
};
