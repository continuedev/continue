import { ToolCallDelta } from "core";
import { createRuleBlock } from "core/tools/definitions/createRuleBlock";
import { CreateRuleBlockArgs } from "core/tools/implementations/createRuleBlock";
import { useCallback, useContext, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { constructMessages } from "../../redux/util/constructMessages";
import { addToolCallDeltaToState } from "../../util/toolCallState";

const RULE_GENERATION_SYSTEM_MESSAGE = `You are an expert at creating effective rules for AI coding assistants. Create concise, actionable rules that follow these guidelines:

FOCUS:
- Keep rules focused on a single, specific concern
- Be specific and actionable - avoid vague guidance
- Write in imperative language ("Use X", "Always do Y", "Avoid Z")

EXAMPLES FROM CHAT HISTORY:
- Use concrete examples from the chat history when possible
- If they say "don't do X", find instances where "X" was done incorrectly
- Include before/after code examples using this format:

**Example**
\`\`\`typescript
// Bad: Don't do this
const badExample = "from chat history";

// Good: Do this instead  
const goodExample = "corrected version";
\`\`\`

Be concise but comprehensive. The chat history contains real examples of what to do or avoid.`;

export interface UseRuleGenerationReturn {
  generateRule: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  reset: () => void;
}

export function useRuleGeneration(
  inputPrompt: string,
  onGenerate?: (args: CreateRuleBlockArgs) => void,
): UseRuleGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      // Convert current history to ChatHistoryItem format

      // Add our rule generation prompt with instruction to use the tool
      const history = [
        {
          message: {
            role: "system" as const,
            content: RULE_GENERATION_SYSTEM_MESSAGE,
          },
          contextItems: [],
        },
        ...currentHistory,
        {
          message: {
            role: "user" as const,
            content: `The user has requested that we write a new rule. You MUST USE the create_rule_block tool to generate a well-structured rule. Do not say anything else, only call this tool. Here is their request: ${inputPrompt}`,
          },
          contextItems: [],
        },
      ];

      const { messages } = constructMessages(history, undefined, [], {});

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

            // Call the callback if provided with the parsed args
            if (toolCallState?.parsedArgs) {
              onGenerate?.(toolCallState.parsedArgs);
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
  }, []);

  return {
    generateRule,
    isGenerating,
    error,
    reset,
  };
}
