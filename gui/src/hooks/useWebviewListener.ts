import type { ToWebviewProtocol } from "core/protocol/index.js";
import { Message } from "core/util/messenger";
import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

export function useWebviewListener<T extends keyof ToWebviewProtocol>(
  messageType: T,
  handler: (data: ToWebviewProtocol[T][0]) => Promise<ToWebviewProtocol[T][1]>,
  dependencies?: any[],
) {
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(() => {
    const listener = async (event: { data: Message }) => {
      if (event.data.messageType === messageType) {
        const result = await handler(event.data.data);
        ideMessenger.respond(messageType, result, event.data.messageId);
      }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, dependencies ?? []);
}
