import {
  calculateRequestCost,
  CostBreakdown,
} from "core/llm/utils/calculateRequestCost";
import { useMemo } from "react";
import { LLMInteraction } from "./useLLMLog";

/**
 * Hook returning memoized information about single logged prompt/response
 * query to the LLM.
 */
export default function useLLMSummary(interaction: LLMInteraction) {
  return useMemo(() => {
    if (interaction.start == undefined) {
      return {
        result: "",
        type: "",
      };
    }

    const type = interaction.start.kind.slice(5);

    let result;
    switch (interaction.end?.kind) {
      case "cancel":
        result = "Cancelled";
        break;
      case "error":
        result = "Error";
        break;
      case "success":
        result = "Success";
        break;
      case undefined:
        result = "";
    }

    let totalTime,
      toFirstToken,
      tokensPerSecond,
      promptTokens,
      generatedTokens,
      thinkingTokens;
    if (interaction.start != undefined && interaction.results.length > 0) {
      const firstGroup = interaction.results[0];
      const firstItem = firstGroup ? firstGroup[0] : undefined;
      toFirstToken = firstItem
        ? firstItem.timestamp - interaction.start.timestamp
        : undefined;
    }
    if (interaction.end != undefined) {
      totalTime = interaction.end.timestamp - interaction.start.timestamp;
      promptTokens = interaction.end.promptTokens;
      generatedTokens = interaction.end.generatedTokens;
      thinkingTokens = interaction.end.thinkingTokens;
      if (toFirstToken != undefined) {
        tokensPerSecond =
          (generatedTokens + thinkingTokens) /
          ((totalTime - toFirstToken) / 1000);
      }
    } else {
      const lastGroup = interaction.results[interaction.results.length - 1];
      const lastItem = lastGroup ? lastGroup[lastGroup.length - 1] : undefined;
      totalTime = lastItem
        ? lastItem.timestamp - interaction.start.timestamp
        : undefined;
    }

    let costBreakdown: CostBreakdown | null = null;
    if (
      interaction.end?.usage &&
      interaction.start?.provider &&
      interaction.start?.options?.model
    ) {
      costBreakdown = calculateRequestCost(
        interaction.start.provider,
        interaction.start.options.model,
        interaction.end.usage,
      );
    }

    return {
      result,
      type,
      totalTime,
      toFirstToken,
      tokensPerSecond,
      promptTokens,
      generatedTokens,
      thinkingTokens,
      costBreakdown,
    };
  }, [interaction]);
}
