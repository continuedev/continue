import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getTaskManagerForSession } from "../../context/taskList";

export const taskListImpl: ToolImpl = async (args, extras) => {
  let contextItem: ContextItem;
  const manager = getTaskManagerForSession("abcd", extras.messenger!);

  const { action } = args;

  console.log("debug1 task list", manager.list(), "and action", action);

  switch (action) {
    case "add": {
      const taskId = manager.add(args.name, args.description);
      contextItem = {
        name: "Task added",
        description: "Task was added to the queue",
        content: `Task added with ID: ${taskId}`,
      };
      break;
    }
    case "update": {
      manager.update(args.taskId, args.name, args.description);
      contextItem = {
        name: "Task updated",
        description: "Task was updated",
        content: `Task updated with ID: ${args.taskId}`,
      };
      break;
    }
    case "remove": {
      manager.remove(args.taskId);
      contextItem = {
        name: "Task removed",
        description: "Task was removed",
        content: `Task removed with ID: ${args.taskId}`,
      };
      break;
    }
    case "list": {
      const tasks = manager.list();
      contextItem = {
        name: "Task list",
        description: "Current task list",
        content: JSON.stringify(tasks, null, 2),
      };
      break;
    }
    case "start": {
      const task = manager.next();
      if (task) {
        contextItem = {
          name: "Task started",
          description: "Task processing started",
          content: JSON.stringify(
            {
              ...task,
              hasNextTask: true,
            },
            null,
            2,
          ),
        };
      } else {
        contextItem = {
          name: "Tasks completed",
          description: "Tasks in queue completed",
          content: JSON.stringify(
            {
              hasNextTask: false,
            },
            null,
            2,
          ),
        };
      }
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
