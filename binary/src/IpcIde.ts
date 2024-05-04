import { TODO } from "core/util";
import { MessageIde } from "core/util/messageIde";
import { IpcMessenger } from "./messenger";

export class IpcIde extends MessageIde {
  constructor(messenger: IpcMessenger<TODO, TODO>) {
    super(messenger.request.bind(messenger));
  }
}
