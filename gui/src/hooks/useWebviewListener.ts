import { Message } from "core/util/messenger";
import { ReverseWebviewProtocol } from "core/web/webviewProtocol";
import { useEffect } from "react";
import { respondToIde } from "../util/ide";

export function useWebviewListener<T extends keyof ReverseWebviewProtocol>(
  messageType: T,
  handler: (
    data: ReverseWebviewProtocol[T][0]
  ) => Promise<ReverseWebviewProtocol[T][1]>,
  dependencies?: any[]
) {
  useEffect(() => {
    const listener = async (event: { data: Message }) => {
      if (event.data.messageType === messageType) {
        const result = await handler(event.data.data);
        respondToIde(messageType, result, event.data.messageId);
      }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, dependencies ?? []);
}
