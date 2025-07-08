import React, { useState } from "react";
import { LLMLog } from "../../hooks/useLLMLog";
import useTotalUsage from "../../hooks/useTotalUsage";

interface TotalUsageProps {
  llmLog: LLMLog;
}

const StatCard: React.FC<{ label: string; value: number; color?: string }> = ({
  label,
  value,
  color = "var(--vscode-foreground)",
}) => (
  <div className="flex flex-col items-center rounded-lg border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-3">
    <div className="text-sm text-[color:var(--vscode-descriptionForeground)]">
      {label}
    </div>
    <div className="text-lg font-semibold" style={{ color }}>
      {value.toLocaleString()}
    </div>
  </div>
);

const TotalUsage: React.FC<TotalUsageProps> = ({ llmLog }) => {
  const totalUsage = useTotalUsage(llmLog);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  return (
    <div className="border-b border-[color:var(--vscode-panel-border)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[color:var(--vscode-foreground)]">
          Total Usage Summary
        </h2>
        <div className="flex items-center gap-4">
          {totalUsage.totalCost > 0 && (
            <button
              onClick={() => setShowCostBreakdown(!showCostBreakdown)}
              className="cursor-pointer text-lg font-semibold text-[color:var(--vscode-charts-green)] hover:text-[color:var(--vscode-charts-blue)]"
            >
              ${totalUsage.totalCost.toFixed(6)}
            </button>
          )}
          <div className="text-sm text-[color:var(--vscode-descriptionForeground)]">
            {totalUsage.totalInteractions} interactions
          </div>
        </div>
      </div>

      {showCostBreakdown && totalUsage.costBreakdowns.length > 0 && (
        <div className="mb-4 max-h-32 overflow-y-auto rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-3">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--vscode-foreground)]">
            Cost Breakdown
          </h3>
          <div className="space-y-2 text-xs">
            {totalUsage.costBreakdowns.map((breakdown, index) => (
              <div
                key={index}
                className="border-b border-[color:var(--vscode-panel-border)] pb-2 last:border-b-0"
              >
                <pre className="whitespace-pre-wrap text-[color:var(--vscode-descriptionForeground)]">
                  {breakdown.breakdown}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Input Tokens"
          value={totalUsage.totalPromptTokens}
          color="var(--vscode-charts-blue)"
        />
        <StatCard
          label="Output Tokens"
          value={totalUsage.totalGeneratedTokens}
          color="var(--vscode-charts-green)"
        />
        <StatCard
          label="Thinking Tokens"
          value={totalUsage.totalThinkingTokens}
          color="var(--vscode-charts-purple)"
        />
        <StatCard
          label="Cache Read"
          value={totalUsage.totalCachedTokens}
          color="var(--vscode-charts-orange)"
        />
      </div>

      {totalUsage.totalCost > 0 && (
        <div className="mb-4">
          <div className="flex flex-col items-center rounded-lg border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-3">
            <div className="text-sm text-[color:var(--vscode-descriptionForeground)]">
              Total Cost
            </div>
            <div className="text-2xl font-bold text-[color:var(--vscode-charts-green)]">
              ${totalUsage.totalCost.toFixed(6)}
            </div>
            <div className="text-xs text-[color:var(--vscode-descriptionForeground)]">
              {totalUsage.costBreakdowns.length} cost calculations
            </div>
          </div>
        </div>
      )}

      {totalUsage.totalCacheWriteTokens > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatCard
            label="Cache Write"
            value={totalUsage.totalCacheWriteTokens}
            color="var(--vscode-charts-red)"
          />
          <div className="flex items-center justify-center rounded-lg border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-3">
            <div className="text-sm text-[color:var(--vscode-descriptionForeground)]">
              Cache Hit Rate:{" "}
              {totalUsage.totalPromptTokens > 0
                ? (
                    (totalUsage.totalCachedTokens /
                      totalUsage.totalPromptTokens) *
                    100
                  ).toFixed(1)
                : "0"}
              %
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-2 text-center">
          <div className="text-[color:var(--vscode-charts-green)]">
            {totalUsage.totalSuccessfulInteractions}
          </div>
          <div className="text-[color:var(--vscode-descriptionForeground)]">
            Success
          </div>
        </div>
        <div className="rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-2 text-center">
          <div className="text-[color:var(--vscode-charts-red)]">
            {totalUsage.totalErrorInteractions}
          </div>
          <div className="text-[color:var(--vscode-descriptionForeground)]">
            Error
          </div>
        </div>
        <div className="rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-2 text-center">
          <div className="text-[color:var(--vscode-charts-yellow)]">
            {totalUsage.totalCancelledInteractions}
          </div>
          <div className="text-[color:var(--vscode-descriptionForeground)]">
            Cancelled
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalUsage;
