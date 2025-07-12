import { v4 as uuidv4 } from "uuid";
import { Session, TaskInfo, TaskStatusType } from "../..";

const TaskStatus: Record<TaskStatusType, string> = {
  Pending: "pending",
  Running: "running",
  Completed: "completed",
};

export class TaskManager {
  private queue: TaskInfo["id"][] = [];
  private taskMap = new Map<TaskInfo["id"], TaskInfo>();
  private previousTaskId: TaskInfo["id"] | null = null;

  add(name: string, description: string) {
    const taskId = uuidv4();
    this.taskMap.set(taskId, {
      id: taskId,
      name,
      description,
      status: TaskStatus.Pending,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    this.queue.push(taskId);
    return taskId;
  }

  update(taskId: TaskInfo["id"], name: string, description: string) {
    this.taskMap.set(taskId, {
      ...this.taskMap.get(taskId)!,
      name,
      description,
      metadata: {
        ...this.taskMap.get(taskId)!.metadata,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  remove(taskId: TaskInfo["id"]) {
    this.taskMap.delete(taskId);
    this.queue = this.queue.filter((id) => id !== taskId);
  }

  list() {
    return Array.from(this.taskMap.values());
  }

  next() {
    if (this.previousTaskId) {
      this.taskMap.set(this.previousTaskId, {
        ...this.taskMap.get(this.previousTaskId)!,
        status: TaskStatus.Completed,
      });
    }
    if (this.queue.length === 0) {
      return null;
    }
    const currentTaskId = this.queue.shift()!;
    this.taskMap.set(currentTaskId, {
      ...this.taskMap.get(currentTaskId)!,
      status: TaskStatus.Running,
      metadata: {
        ...this.taskMap.get(currentTaskId)!.metadata,
        updatedAt: new Date().toISOString(),
      },
    });
    return this.taskMap.get(currentTaskId)!;
  }

  // TODO
  //   start(taskId: TaskInfo["id"]) {
  //     this.updatePreviousTask(taskId, TaskStatus.Pending); // this
  //     this.taskMap.set(taskId, {
  //       ...this.taskMap.get(taskId)!,
  //       status: TaskStatus.Running,
  //     });
  //   }
}

const taskManagers = new Map<Session["sessionId"], TaskManager>();

export function getTaskManagerForSession(sessionId: Session["sessionId"]) {
  if (taskManagers.has(sessionId)) {
    return taskManagers.get(sessionId)!;
  }
  const newManager = new TaskManager();
  taskManagers.set(sessionId, newManager);
  return newManager;
}
