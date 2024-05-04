import { TODO } from "core/util";
import { MessageIde } from "core/util/messageIde";

export class IpcIde extends MessageIde {
  constructor(messenger: TODO) {
    super(messenger.request.bind(messenger));
  }
}
