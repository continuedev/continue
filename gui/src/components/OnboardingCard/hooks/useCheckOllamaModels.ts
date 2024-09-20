import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ONBOARDING_LOCAL_MODEL_TITLE } from "core/config/onboarding";
import { withExponentialBackoff } from "core/util/withExponentialBackoff";

const CHECK_OLLAMA_CONNECTION_INTERVAL = 1000;

export const useCheckOllamaModels = (
  onDownloadedModels: (models: string[]) => void,
) => {
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(() => {
    const fetchDownloadedModels = async () => {
      const result = await withExponentialBackoff(() =>
        ideMessenger.request("llm/listModels", {
          title: ONBOARDING_LOCAL_MODEL_TITLE,
        })
      );

      if (result.status === "success") {
        const models = result.content;

        if (Array.isArray(models)) {
          onDownloadedModels(models);
          clearInterval(interval);
        }
      }
    };

    fetchDownloadedModels();

    const interval = setInterval(
      fetchDownloadedModels,
      CHECK_OLLAMA_CONNECTION_INTERVAL,
    );

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [ideMessenger, onDownloadedModels]);
};
