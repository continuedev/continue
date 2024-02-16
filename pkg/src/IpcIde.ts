import { MessageIde } from "core/util/messageIde";
import { IpcMessenger } from "./messenger";

export class IpcIde extends MessageIde {
  constructor(messenger: IpcMessenger) {
    super(messenger.request.bind(messenger));
  }
}
