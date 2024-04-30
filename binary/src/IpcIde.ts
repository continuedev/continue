import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { MessageIde } from "core/util/messageIde";
import { IpcMessenger } from "./messenger";

export class IpcIde extends MessageIde {
  constructor(messenger: IpcMessenger<any, ToIdeFromWebviewOrCoreProtocol>) {
    super(messenger.request.bind(messenger));
  }
}
