import { Session } from "../..";
import type { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import type { IMessenger } from "../../protocol/messenger";
import { TaskManager } from "./TaskManager";

// in memory storage for storing individual task lists
const taskManagers = new Map<Session["sessionId"], TaskManager>();

export async function getSessionTaskManager(
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  const sessionId = await messenger.request("getCurrentSessionId", undefined);
  if (taskManagers.has(sessionId)) {
    return taskManagers.get(sessionId)!;
  }
  const newManager = new TaskManager(messenger);
  taskManagers.set(sessionId, newManager);
  return newManager;
}

export async function fetchTaskList(
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  return (await getSessionTaskManager(messenger)).list();
}
