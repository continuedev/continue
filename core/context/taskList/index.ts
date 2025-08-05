import type { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import type { IMessenger } from "../../protocol/messenger";
import { TaskManager } from "./TaskManager";

export async function getSessionTaskManager(
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  const sessionId = await messenger.request("getCurrentSessionId", undefined);
  return new TaskManager(messenger, sessionId);
}

export async function fetchTaskList(
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  return (await getSessionTaskManager(messenger)).list();
}
