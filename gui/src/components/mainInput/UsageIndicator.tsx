import {
  contextUsage,
  formatCost,
  formatTokens,
  summarizeSessionUsage,
} from "core/llm/utils/sessionUsage";
import { useMemo } from "react";
import { useAppSelector } from "../../redux/hooks";
import { ToolTip } from "../gui/Tooltip";

/**
 * Small usage readout in the input toolbar: context used against the model's
 * window, with a tooltip that breaks down tokens and estimated cost per model
 * for this session. Hidden until the first request reports usage.
 */
export function UsageIndicator() {
  const usage = useAppSelector((s) => s.session.usage);
  const chatModels = useAppSelector(
    (s) => s.config.config.modelsByRole?.chat ?? [],
  );
  const selected = useAppSelector(
    (s) => s.config.config.selectedModelByRole.chat,
  );

  const summary = useMemo(() => summarizeSessionUsage(usage), [usage]);
  const last = usage?.lastRequest;
  const contextLength = useMemo(() => {
    if (!last) return undefined;
    const match =
      chatModels.find(
        (m) => m.provider === last.provider && m.model === last.model,
      ) ??
      (selected?.model === last.model && selected.provider === last.provider
        ? selected
        : undefined);
    return match?.contextLength;
  }, [last, chatModels, selected]);
  const context = contextUsage(usage, contextLength);

  if (!usage || summary.requests === 0) return null;

  const percent = context ? Math.round(context.fraction * 100) : undefined;
  const models = Object.values(usage.byModel ?? {});

  const content = (
    <div
      className="flex flex-col gap-1 text-left text-xs"
      data-testid="usage-tooltip"
    >
      {context ? (
        <span>
          Context: {formatTokens(context.tokens)} of{" "}
          {formatTokens(context.limit)} tokens ({percent}%)
        </span>
      ) : (
        <span>Context window unknown for this model.</span>
      )}
      <span>
        Session: {formatTokens(summary.inputTokens)} in,{" "}
        {formatTokens(summary.outputTokens)} out
        {summary.cacheReadTokens > 0 || summary.cacheWriteTokens > 0
          ? `, ${formatTokens(summary.cacheReadTokens)} cache read, ${formatTokens(summary.cacheWriteTokens)} cache write`
          : ""}
      </span>
      <span>
        {summary.cost === undefined
          ? "Cost: no price known for these models, tokens only."
          : `Estimated cost: ${summary.costIsPartial ? "at least " : ""}${formatCost(summary.cost)}${summary.costIsPartial ? " (some models have no known price)" : ""}`}
      </span>
      {models.length > 1 &&
        models.map((m) => (
          <span
            key={`${m.provider}/${m.model}`}
            className="text-description-muted"
          >
            {m.model}: {formatTokens(m.inputTokens)} in,{" "}
            {formatTokens(m.outputTokens)} out
            {m.pricedRequests > 0 ? `, ${formatCost(m.cost)}` : ""}
          </span>
        ))}
    </div>
  );

  return (
    <ToolTip place="top" content={content}>
      <span
        data-testid="usage-indicator"
        className="flex flex-none items-center gap-1 text-description"
      >
        {context ? (
          <span
            className="relative h-[3px] w-6 overflow-hidden rounded-xs bg-command-border"
            aria-hidden
          >
            <span
              className={`absolute top-0 left-0 h-full ${context.fraction >= 0.9 ? "bg-error" : "bg-description"}`}
              style={{ width: `${percent}%` }}
            />
          </span>
        ) : null}
        <span>
          {context
            ? `${percent}%`
            : formatTokens(summary.inputTokens + summary.outputTokens)}
          {summary.cost !== undefined ? ` · ${formatCost(summary.cost)}` : ""}
        </span>
      </span>
    </ToolTip>
  );
}
