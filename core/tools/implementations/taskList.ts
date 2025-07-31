import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getSessionTaskManager } from "../../context/taskList";
import { TaskStatus } from "../../context/taskList/TaskManager";

export const taskListImpl: ToolImpl = async (args, extras) => {
  let contextItem: ContextItem;
  const manager = await getSessionTaskManager(extras.messenger!);

  const { action } = args;

  console.log(
    "debug1 task list",
    manager.list(),
    "and action",
    action,
    "and session",
    await extras.messenger?.request("getCurrentSessionId", undefined),
  );

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
      manager.update(args.taskId, args.name, args.description);
      contextItem = {
        name: "Update task",
        description: "Task was updated",
        content: `Task updated with ID: ${args.taskId}`,
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
    case "runTask": {
      const task = manager.getTaskById(args.taskId);
      manager.setTaskStatus(task.id, TaskStatus.Completed);
      contextItem = {
        name: "Start task",
        description: "Perform the following task operation",
        content: JSON.stringify(task, null, 2),
      };
      break;
    }
    default: {
      throw new Error(
        `Unknown task action: ${action}. Valid actions are: add, update, remove, list, start`,
      );
    }
  }

  console.log("debug1 context item", contextItem);

  return [contextItem];
};
