import historyManager from "../util/history";
import { IpcIde } from "./IpcIde";
import { IpcMessenger } from "./messenger";

export class Core {
  private messenger: IpcMessenger;
  private ide: IpcIde;
  constructor(messenger: IpcMessenger) {
    this.messenger = messenger;
    this.ide = new IpcIde(messenger);

    this.messenger.on("history/list", (msg) => {
      return historyManager.list();
    });
    this.messenger.on("history/delete", (msg) => {
      historyManager.delete(msg.data.id);
    });
  }
}
