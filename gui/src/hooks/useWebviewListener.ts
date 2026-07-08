import type { ToWebviewProtocol } from "core/protocol/index.js";
import { Message } from "core/protocol/messenger";
import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

export function useWebviewListener<T extends keyof ToWebviewProtocol>(
  messageType: T,
  handler: (data: ToWebviewProtocol[T][0]) => Promise<ToWebviewProtocol[T][1]>,
  dependencies?: any[],
  skip?: boolean,
) {
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(
    () => {
      let listener: (event: {
        data: Message<ToWebviewProtocol[T][0]>;
      }) => Promise<void>;

      if (!skip) {
        listener = async (event) => {
          if (event.data.messageType === messageType) {
            const result = await handler(event.data.data);
            ideMessenger.respond(messageType, result, event.data.messageId);
          }
        };

        window.addEventListener("message", listener);
      }

      return () => {
        if (listener) {
          window.removeEventListener("message", listener);
        }
      };
    },
    dependencies ? [...dependencies, skip, ideMessenger] : [skip, ideMessenger],
  );
}
