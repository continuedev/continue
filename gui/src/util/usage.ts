import { ChatHistoryItem, Usage } from "core";

export interface SessionUsageTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  turnsWithUsage: number;
}

export function summarizeSessionUsage(
  history: ChatHistoryItem[],
): SessionUsageTotals {
  return history.reduce<SessionUsageTotals>(
    (acc, item) => {
      if (item.message.role !== "assistant" || !item.message.usage) {
        return acc;
      }

      const usage = item.message.usage;
      const promptTokens = usage.promptTokens ?? 0;
      const completionTokens = usage.completionTokens ?? 0;
      const totalTokens = usage.totalTokens ?? promptTokens + completionTokens;

      acc.promptTokens += promptTokens;
      acc.completionTokens += completionTokens;
      acc.totalTokens += totalTokens;
      acc.turnsWithUsage += 1;
      return acc;
    },
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      turnsWithUsage: 0,
    },
  );
}

export function formatUsageFooter(usage: Usage): string {
  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const totalTokens = usage.totalTokens ?? promptTokens + completionTokens;
  return formatTokenBreakdown({
    promptTokens,
    completionTokens,
    totalTokens,
  });
}

export function formatTokenBreakdown(params: {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}): string {
  const promptTokens = params.promptTokens ?? 0;
  const completionTokens = params.completionTokens ?? 0;
  const totalTokens = params.totalTokens ?? promptTokens + completionTokens;
  return `Tokens used: ${promptTokens.toLocaleString()} in / ${completionTokens.toLocaleString()} out (${totalTokens.toLocaleString()} total)`;
}
