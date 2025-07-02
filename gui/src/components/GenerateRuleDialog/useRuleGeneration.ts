import { ChatMessage, ToolCallDelta } from "core";
import { createRuleBlock } from "core/tools/definitions/createRuleBlock";
import { CreateRuleBlockArgs } from "core/tools/implementations/createRuleBlock";
import { useCallback, useContext, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { addToolCallDeltaToState } from "../../util/toolCallState";

export interface UseRuleGenerationReturn {
  generateRule: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  reset: () => void;
  createRuleBlockArgs: CreateRuleBlockArgs | null;
}

export function useRuleGeneration(
  inputPrompt: string,
): UseRuleGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createRuleBlockArgs, setCreateRuleBlockArgs] =
    useState<CreateRuleBlockArgs | null>(null);

  const ideMessenger = useContext(IdeMessengerContext);
  const currentHistory = useAppSelector((state) => state.session.history);
  const selectedChatModel = useAppSelector(selectSelectedChatModel);

  const generateRule = useCallback(async () => {
    if (!selectedChatModel) {
      setError("No chat model selected");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCreateRuleBlockArgs(null);

    try {
      // Convert current history to ChatMessage format
      const chatMessages: ChatMessage[] = currentHistory.map(
        (item) => item.message,
      );

      // Add our rule generation prompt with instruction to use the tool
      const messages: ChatMessage[] = [
        ...chatMessages,
        {
          role: "user",
          content: `The user has requested that we write a new rule. You MUST USE the create_rule_block tool to generate a well-structured rule. Here is their request: ${inputPrompt}`,
        },
      ];

      // Create abort controller for this request
      const abortController = new AbortController();

      // Stream the response with createRuleBlock tool
      const gen = ideMessenger.llmStreamChat(
        {
          messages,
          completionOptions: {
            tools: [createRuleBlock],
          },
          title: selectedChatModel.title,
        },
        abortController.signal,
      );

      let toolCallState: any = undefined;

      // Process each chunk
      for await (const chunks of gen) {
        for (const chunk of chunks) {
          // Handle tool calls - this is what we care about
          if (chunk.role === "assistant" && chunk.toolCalls?.length) {
            const toolCallDelta: ToolCallDelta = chunk.toolCalls[0];
            toolCallState = addToolCallDeltaToState(
              toolCallDelta,
              toolCallState,
            );

            // Update the tool call args state as we stream
            if (toolCallState?.parsedArgs) {
              setCreateRuleBlockArgs(toolCallState.parsedArgs);
            }
          }
          // Ignore regular assistant content - we only care about the tool call
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  }, [ideMessenger, currentHistory, selectedChatModel, inputPrompt]);

  const reset = useCallback(() => {
    setError(null);
    setIsGenerating(false);
    setCreateRuleBlockArgs(null);
  }, []);

  return {
    generateRule,
    isGenerating,
    error,
    reset,
    createRuleBlockArgs,
  };
}
