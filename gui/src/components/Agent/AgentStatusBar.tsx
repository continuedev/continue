/**
 * AgentStatusBar — turn counter, current status label, and abort button.
 * Rendered at the top of the agent view while a session is active.
 */

import { StopCircleIcon } from "@heroicons/react/24/outline";
import { AnimatedEllipsis } from "../AnimatedEllipsis";

export type AgentSessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed";

const STATUS_LABEL: Record<AgentSessionStatus, string> = {
  pending: "Starting",
  running: "Running",
  completed: "Done",
  failed: "Failed",
  killed: "Stopped",
};

const STATUS_COLOR: Record<AgentSessionStatus, string> = {
  pending: "text-yellow-400",
  running: "text-blue-400",
  completed: "text-green-400",
  failed: "text-red-400",
  killed: "text-zinc-400",
};

export interface AgentStatusBarProps {
  status: AgentSessionStatus;
  totalTurns: number;
  maxTurns?: number;
  stopReason?: string;
  onAbort: () => void;
}

export function AgentStatusBar({
  status,
  totalTurns,
  maxTurns = 50,
  stopReason,
  onAbort,
}: AgentStatusBarProps) {
  const isActive = status === "running" || status === "pending";

  return (
    <div className="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-1.5 text-xs">
      {/* Left: status + turn count */}
      <div className="flex items-center gap-3">
        <span className={`font-semibold ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
          {isActive && <AnimatedEllipsis />}
        </span>

        <span className="text-zinc-400">
          Turn {totalTurns} / {maxTurns}
        </span>

        {stopReason && (
          <span className="text-zinc-500 italic">({stopReason})</span>
        )}
      </div>

      {/* Right: abort button (only while active) */}
      {isActive && (
        <button
          onClick={onAbort}
          title="Stop agent"
          className="flex items-center gap-1 rounded px-2 py-0.5 text-red-400 hover:bg-zinc-700 hover:text-red-300"
        >
          <StopCircleIcon className="h-4 w-4" />
          <span>Stop</span>
        </button>
      )}
    </div>
  );
}
