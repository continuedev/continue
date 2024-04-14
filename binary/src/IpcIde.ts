import { TODO } from "core/util";
import { MessageIde } from "core/util/messageIde";
import type { IpcMessenger } from "./messenger";

export class IpcIde extends MessageIde {
  constructor(messenger: TODO) {
    super(messenger.request.bind(messenger));
  }
}
