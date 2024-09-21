import { useContext, useEffect, useRef } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ONBOARDING_LOCAL_MODEL_TITLE } from "core/config/onboarding";

const MAX_RETRIES = 10;
const INITIAL_DELAY = 1000;

export const useCheckOllamaModels = (
  onDownloadedModels: (models: string[]) => void,
) => {
  const ideMessenger = useContext(IdeMessengerContext);
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchDownloadedModels = async () => {
      try {
        const result = (await ideMessenger.request("llm/listModels", {
          title: ONBOARDING_LOCAL_MODEL_TITLE,
        })) as any;

        if (result.status === "success") {
          const models = result.content;

          if (Array.isArray(models)) {
            onDownloadedModels(models);
            return;
          }
        }

        throw new Error("Failed to fetch models");
      } catch (error) {
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = INITIAL_DELAY * Math.pow(2, retryCountRef.current);
          console.debug(
            `Failed to connect to Ollama - retrying in ${delay}ms...`,
          );
          timeoutRef.current = setTimeout(() => {
            retryCountRef.current += 1;
            fetchDownloadedModels();
          }, delay);
        } else {
          console.debug(
            `Max retries (${MAX_RETRIES}) reached. Unable to fetch Ollama models.`,
          );
        }
      }
    };

    fetchDownloadedModels();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [ideMessenger, onDownloadedModels]);
};
