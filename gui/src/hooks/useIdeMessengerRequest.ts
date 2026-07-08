import type { FromWebviewProtocol } from "core/protocol";
import type { SuccessWebviewSingleMessage } from "core/protocol/util";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

/**
 * Generic hook for making IDE messenger requests with automatic error handling and refresh capability
 */
export function useIdeMessengerRequest<T extends keyof FromWebviewProtocol>(
  messageType: T,
  data: FromWebviewProtocol[T][0] | null,
) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [result, setResult] = useState<
    SuccessWebviewSingleMessage<FromWebviewProtocol[T][1]>["content"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  async function makeRequest() {
    if (!data) {
      setResult(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await ideMessenger.request(messageType, data);
      if (response.status === "success") {
        setResult(response.content);
      } else {
        console.error(`Error in ${messageType} request:`, response.error);
        setResult(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    makeRequest();
  }, [data, messageType]);

  return { result, isLoading, refresh: makeRequest };
}
