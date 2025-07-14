import { v4 as uuidv4 } from "uuid";
import { TaskInfo, TaskStatusType } from "../..";
import type { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import type { IMessenger } from "../../protocol/messenger";

const TaskStatus: Record<TaskStatusType, string> = {
  Pending: "pending",
  Running: "running",
  Completed: "completed",
};

export interface TaskEvent {
  type: "add" | "update" | "remove";
  tasks: TaskInfo[];
}

export class TaskManager {
  private queue: TaskInfo["id"][] = [];
  private taskMap = new Map<TaskInfo["id"], TaskInfo>();
  private previousTaskId: TaskInfo["id"] | null = null;

  constructor(
    private messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
  ) {}

  private emitEvent(eventType: TaskEvent["type"]): void {
    // TODO: messenger.send is null - need to figure out the reason
    // this.messenger.send("taskEvent", {
    //   type: eventType,
    //   tasks: this.list(),
    // });
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
    this.queue.push(taskId);

    this.emitEvent("add");

    return taskId;
  }

  update(taskId: TaskInfo["id"], name: string, description: string) {
    const previousTask = this.taskMap.get(taskId);
    if (!previousTask) {
      return;
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
    this.queue = this.queue.filter((id) => id !== taskId);

    this.emitEvent("remove");
  }

  list() {
    return Array.from(this.taskMap.values());
  }

  next() {
    if (this.previousTaskId) {
      const previousTask = this.taskMap.get(this.previousTaskId);
      if (previousTask) {
        const updatedPreviousTask: TaskInfo = {
          ...previousTask,
          status: TaskStatus.Completed,
        };
        this.taskMap.set(this.previousTaskId, updatedPreviousTask);

        this.emitEvent("update");
      }
    }

    if (this.queue.length === 0) {
      return null;
    }

    const currentTaskId = this.queue.shift()!;
    const currentTask = this.taskMap.get(currentTaskId)!;
    const updatedCurrentTask: TaskInfo = {
      ...currentTask,
      status: TaskStatus.Running,
      metadata: {
        ...currentTask.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    this.taskMap.set(currentTaskId, updatedCurrentTask);
    this.previousTaskId = currentTaskId;

    this.emitEvent("update");

    return updatedCurrentTask;
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
