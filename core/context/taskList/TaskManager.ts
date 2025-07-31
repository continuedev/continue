import { v4 as uuidv4 } from "uuid";
import { TaskInfo } from "../..";
import type { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import type { IMessenger } from "../../protocol/messenger";

export enum TaskStatus {
  Pending = "pending",
  Completed = "completed",
}

export interface TaskEvent {
  type: "add" | "update" | "remove";
  tasks: TaskInfo[];
}

export class TaskManager {
  private taskMap = new Map<TaskInfo["id"], TaskInfo>();

  constructor(
    private messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
  ) {}

  private emitEvent(eventType: TaskEvent["type"]): void {
    this.messenger.send("taskEvent", {
      type: eventType,
      tasks: this.list(),
    });
  }

  add(name: string, description: string) {
    const taskId = uuidv4();
    const task: TaskInfo = {
      id: taskId,
      name,
      description,
      status: TaskStatus.Pending,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    this.taskMap.set(taskId, task);

    this.emitEvent("add");

    return taskId;
  }

  update(taskId: TaskInfo["id"], name: string, description: string) {
    const previousTask = this.taskMap.get(taskId);
    if (!previousTask) {
      throw new Error(`Task with id "${taskId}" not found`);
    }

    const updatedTask: TaskInfo = {
      ...previousTask,
      name,
      description,
      metadata: {
        ...previousTask.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    this.taskMap.set(taskId, updatedTask);

    this.emitEvent("update");
  }

  remove(taskId: TaskInfo["id"]) {
    const task = this.taskMap.get(taskId);
    if (!task) {
      return;
    }

    this.taskMap.delete(taskId);

    this.emitEvent("remove");
  }

  list() {
    return Array.from(this.taskMap.values());
  }

  setTaskStatus(taskId: TaskInfo["id"], status: TaskStatus) {
    if (!this.taskMap.has(taskId)) {
      throw new Error(`Task with id "${taskId}" not found`);
    }
    this.taskMap.set(taskId, {
      ...this.taskMap.get(taskId)!,
      status,
    });
  }

  getTaskById(taskId: TaskInfo["id"]) {
    if (!this.taskMap.has(taskId)) {
      throw new Error(`Task with id "${taskId}" not found`);
    }
    return this.taskMap.get(taskId)!;
  }
}
