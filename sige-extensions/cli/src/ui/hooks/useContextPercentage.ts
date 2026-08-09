import { ModelConfig } from "@continuedev/config-yaml";
import type { ChatHistoryItem } from "core/index.js";
import { useMemo } from "react";

import {
  calculateContextUsagePercentage,
  countChatHistoryTokens,
} from "../../util/tokenizer.js";

interface UseContextPercentageProps {
  chatHistory: ChatHistoryItem[];
  model?: ModelConfig;
}

/**
 * Hook to calculate the current context usage percentage
 * This uses the same logic as the compaction trigger to show users
 * how close they are to the context limit
 */
export function useContextPercentage({
  chatHistory,
  model,
}: UseContextPercentageProps) {
  const contextData = useMemo(() => {
    // Return null if no model is available
    if (!model) {
      return null;
    }

    // Calculate token count and percentage
    const tokenCount = countChatHistoryTokens(chatHistory, model);
    const percentage = calculateContextUsagePercentage(tokenCount, model);

    return {
      tokenCount,
      percentage,
    };
  }, [chatHistory, model]);

  return contextData;
}
