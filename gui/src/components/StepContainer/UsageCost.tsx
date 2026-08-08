import { ChatHistoryItem } from "core";
import { calculateRequestCost } from "core/llm/utils/calculateRequestCost";

interface UsageCostProps {
  item: ChatHistoryItem;
}

/**
 * Renders a small footer under an assistant message showing the model,
 * total token usage, and estimated cost (USD) for the request(s) that
 * produced it.
 *
 * Costs are only shown when both token usage and a known model price are
 * available; otherwise that part is omitted rather than displaying a
 * made-up figure.
 */
export default function UsageCost({ item }: UsageCostProps) {
  const promptLogs = item.promptLogs ?? [];
  if (promptLogs.length === 0) {
    return null;
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;
  let costKnown = false;

  for (const log of promptLogs) {
    if (!log.usage) {
      continue;
    }
    promptTokens += log.usage.promptTokens;
    completionTokens += log.usage.completionTokens;
    if (log.modelProvider && log.model) {
      const breakdown = calculateRequestCost(
        log.modelProvider,
        log.model,
        log.usage,
      );
      if (breakdown) {
        cost += breakdown.cost;
        costKnown = true;
      }
    }
  }

  const totalTokens = promptTokens + completionTokens;
  if (totalTokens === 0 && !costKnown) {
    return null;
  }

  const parts: string[] = [promptLogs[0].modelTitle];
  if (totalTokens > 0) {
    parts.push(`${totalTokens.toLocaleString()} tokens`);
  }
  if (costKnown) {
    parts.push(`$${cost.toFixed(4)}`);
  }

  return (
    <div className="text-description-muted text-2xs mx-2 mt-1 flex justify-end">
      {parts.join(" · ")}
    </div>
  );
}
