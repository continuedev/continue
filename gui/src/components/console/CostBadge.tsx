import React from "react";
import useLLMLog from "../../hooks/useLLMLog";
import useTotalUsage from "../../hooks/useTotalUsage";
import { useAppSelector } from "../../redux/hooks";

interface CostBadgeProps {
  className?: string;
}

const CostBadge: React.FC<CostBadgeProps> = ({ className = "" }) => {
  const llmLog = useLLMLog();
  const totalUsage = useTotalUsage(llmLog);

  if (totalUsage.totalCost === 0) {
    return null;
  }

  const formatCost = (cost: number): string => {
    if (cost < 0.0001) return "<$0.00";
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  const getCostColor = (): string => {
    if (totalUsage.totalCost < 0.01) return "var(--vscode-charts-green)";
    if (totalUsage.totalCost < 0.1) return "var(--vscode-charts-yellow)";
    return "var(--vscode-charts-red)";
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${className}`}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--vscode-charts-green) 15%, transparent)",
        color: getCostColor(),
      }}
      title={`Total cost: ${formatCost(totalUsage.totalCost)}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12" />
        <path d="M15.5 9.4a2.5 2.5 0 0 0 0 5.2H8.5a2.5 2.5 0 0 1 0-5.2" />
      </svg>
      <span>{formatCost(totalUsage.totalCost)}</span>
    </div>
  );
};

export default CostBadge;
