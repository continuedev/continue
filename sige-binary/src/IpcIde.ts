import { TODO } from "core/util";
import { MessageIde } from "core/protocol/messenger/messageIde";

export class IpcIde extends MessageIde {
  constructor(messenger: TODO) {
    super(messenger.request.bind(messenger), messenger.on.bind(messenger));
  }
}
