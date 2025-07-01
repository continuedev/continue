import { ChatMessage } from "core";
import { useCallback, useContext, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";

interface UseRuleGenerationReturn {
  generateRule: (prompt: string) => Promise<void>;
  generatedContent: string;
  isGenerating: boolean;
  error: string | null;
  reset: () => void;
}

export function useRuleGeneration(): UseRuleGenerationReturn {
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ideMessenger = useContext(IdeMessengerContext);
  const currentHistory = useAppSelector((state) => state.session.history);
  const selectedChatModel = useAppSelector(selectSelectedChatModel);

  const generateRule = useCallback(
    async (prompt: string) => {
      if (!selectedChatModel) {
        setError("No chat model selected");
        return;
      }

      setIsGenerating(true);
      setError(null);
      setGeneratedContent("");

      try {
        // Convert current history to ChatMessage format
        const chatMessages: ChatMessage[] = currentHistory.map(
          (item) => item.message,
        );

        // Add our rule generation prompt
        const messages: ChatMessage[] = [
          ...chatMessages,
          {
            role: "user",
            content: `The user has requested that we write a new rule. Here is their request: ${prompt}`,
          },
        ];

        // Create abort controller for this request
        const abortController = new AbortController();

        // Stream the response
        const gen = ideMessenger.llmStreamChat(
          {
            messages,
            completionOptions: {},
            title: selectedChatModel.title,
          },
          abortController.signal,
        );

        let accumulatedContent = "";

        // Process each chunk
        for await (const chunks of gen) {
          for (const chunk of chunks) {
            if (chunk.role === "assistant" && chunk.content) {
              accumulatedContent += chunk.content;
              setGeneratedContent(accumulatedContent);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsGenerating(false);
      }
    },
    [ideMessenger, currentHistory, selectedChatModel],
  );

  const reset = useCallback(() => {
    setGeneratedContent("");
    setError(null);
    setIsGenerating(false);
  }, []);

  return {
    generateRule,
    generatedContent,
    isGenerating,
    error,
    reset,
  };
}
