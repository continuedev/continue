import { ToolCallDelta } from "core";
import { createRuleBlock } from "core/tools/definitions/createRuleBlock";
import { CreateRuleBlockArgs } from "core/tools/implementations/createRuleBlock";
import { useCallback, useContext, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { constructMessages } from "../../redux/util/constructMessages";
import { addToolCallDeltaToState } from "../../util/toolCallState";

const RULE_GENERATION_SYSTEM_MESSAGE = `You are an expert at creating effective rules for AI coding assistants. When generating rules, follow these best practices:

FOCUS AND SCOPE:
- Keep rules focused on a single, specific concern
- Make rules actionable with clear, concrete instructions
- Write rules like clear internal documentation
- Avoid vague guidance - be specific about what to do

STRUCTURE:
- Keep rules under 500 lines
- Use imperative language ("Use X", "Always do Y", "Avoid Z")
- Provide concrete examples when possible
- Break complex rules into multiple, composable rules

CONTENT GUIDELINES:
- Include specific coding patterns, conventions, or architectural decisions
- Reference actual file examples or templates when relevant
- Encode domain-specific knowledge about the codebase
- Standardize style or workflow decisions

EXAMPLES FROM CHAT HISTORY:
- Always try to construct concrete examples for the rule based on the user's request and chat history
- If they say "don't do X", look in the chat history for instances where "X" was done incorrectly
- If they mention a pattern or approach, find code examples from the conversation that demonstrate it
- Use actual code snippets from the chat history to create before/after examples
- Format examples using markdown with the **Example** header like this:

**Example**
\`\`\`typescript
// Bad: Don't do this
const badExample = "from chat history";

// Good: Do this instead  
const goodExample = "corrected version";
\`\`\`

RULE METADATA:
- Provide a clear, descriptive name that summarizes the rule's purpose
- Write a concise description explaining what the rule does
- Use appropriate glob patterns to scope the rule to relevant file types
- Consider whether the rule should be regex-based for content matching

Remember: Good rules are persistent context that helps the AI understand project-specific requirements, coding standards, and workflows. The chat history is a goldmine for finding real examples of what to do or avoid.`;

export interface UseRuleGenerationReturn {
  generateRule: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  reset: () => void;
  createRuleBlockArgs: CreateRuleBlockArgs | null;
}

export function useRuleGeneration(
  inputPrompt: string,
  onGenerate?: (args: CreateRuleBlockArgs) => void,
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

            // Update the tool call args state as we stream
            if (toolCallState?.parsedArgs) {
              setCreateRuleBlockArgs(toolCallState.parsedArgs);
              // Call the callback if provided
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
