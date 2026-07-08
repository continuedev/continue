import {
  calculateRequestCost,
  CostBreakdown,
} from "core/llm/utils/calculateRequestCost";
import { useMemo } from "react";
import { LLMLog } from "./useLLMLog";

export interface TotalUsage {
  totalPromptTokens: number;
  totalGeneratedTokens: number;
  totalThinkingTokens: number;
  totalCachedTokens: number;
  totalCacheWriteTokens: number;
  totalInteractions: number;
  totalSuccessfulInteractions: number;
  totalErrorInteractions: number;
  totalCancelledInteractions: number;
  totalCost: number;
  costBreakdowns: CostBreakdown[];
}

/**
 * Hook to calculate total usage across all interactions in the LLM log
 */
export default function useTotalUsage(llmLog: LLMLog): TotalUsage {
  return useMemo(() => {
    let totalPromptTokens = 0;
    let totalGeneratedTokens = 0;
    let totalThinkingTokens = 0;
    let totalCachedTokens = 0;
    let totalCacheWriteTokens = 0;
    let totalInteractions = 0;
    let totalSuccessfulInteractions = 0;
    let totalErrorInteractions = 0;
    let totalCancelledInteractions = 0;
    let totalCost = 0;
    const costBreakdowns: CostBreakdown[] = [];

    // Iterate through all interactions
    for (const interaction of llmLog.interactions.values()) {
      if (interaction.end) {
        totalInteractions++;

        // Add basic token counts
        totalPromptTokens += interaction.end.promptTokens || 0;
        totalGeneratedTokens += interaction.end.generatedTokens || 0;
        totalThinkingTokens += interaction.end.thinkingTokens || 0;

        // Add cache-related tokens from usage if available
        if (interaction.end.usage) {
          const usage = interaction.end.usage;
          totalCachedTokens += usage.promptTokensDetails?.cachedTokens || 0;
          totalCacheWriteTokens +=
            usage.promptTokensDetails?.cacheWriteTokens || 0;

          // Calculate cost if we have the necessary information
          if (
            interaction.start?.provider &&
            interaction.start?.options?.model
          ) {
            const costBreakdown = calculateRequestCost(
              interaction.start.provider,
              interaction.start.options.model,
              usage,
            );
            if (costBreakdown) {
              totalCost += costBreakdown.cost;
              costBreakdowns.push(costBreakdown);
            }
          }
        }

        // Count interaction outcomes
        switch (interaction.end.kind) {
          case "success":
            totalSuccessfulInteractions++;
            break;
          case "error":
            totalErrorInteractions++;
            break;
          case "cancel":
            totalCancelledInteractions++;
            break;
        }
      }
    }

    return {
      totalPromptTokens,
      totalGeneratedTokens,
      totalThinkingTokens,
      totalCachedTokens,
      totalCacheWriteTokens,
      totalInteractions,
      totalSuccessfulInteractions,
      totalErrorInteractions,
      totalCancelledInteractions,
      totalCost,
      costBreakdowns,
    };
  }, [llmLog]);
}
