import { MessageIde } from "core/util/messageIde";
import { WebviewProtocol } from "core/web/webviewProtocol";
import { ideRequest } from "./ide";
function r<T extends keyof WebviewProtocol>(
  messageType: T,
  data: WebviewProtocol[T][0]
): Promise<WebviewProtocol[T][1]> {
  return ideRequest(messageType, data);
}

export class WebviewIde extends MessageIde {
  constructor() {
    super(r);
  }
}
