/**
 * AgentToolCallItem — renders a single tool call event inside the agent view.
 * Shows the tool name, collapsed args, and when available the result or error.
 */

import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

export interface AgentToolCallItemProps {
  toolName: string;
  args: string; // raw JSON string from ToolCall.function.arguments
  result?: string; // string content of the tool result
  error?: string;
  isRunning?: boolean;
}

/** Pretty-print a JSON string, falling back to raw string on parse error */
function formatArgs(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export function AgentToolCallItem({
  toolName,
  args,
  result,
  error,
  isRunning = false,
}: AgentToolCallItemProps) {
  const [expanded, setExpanded] = useState(false);

  const hasResult = result !== undefined || error !== undefined;

  return (
    <div className="my-1 rounded border border-zinc-700 bg-zinc-800 text-sm">
      {/* Header row */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700/50"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Status icon */}
        {isRunning ? (
          <WrenchScrewdriverIcon className="h-4 w-4 animate-pulse text-yellow-400" />
        ) : error ? (
          <ExclamationCircleIcon className="h-4 w-4 text-red-400" />
        ) : (
          <CheckCircleIcon className="h-4 w-4 text-green-400" />
        )}

        <span className="flex-1 font-mono text-xs text-zinc-200">
          {toolName}
        </span>

        {/* Expand toggle */}
        {expanded ? (
          <ChevronDownIcon className="h-3 w-3 text-zinc-400" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 text-zinc-400" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-700 px-3 py-2">
          {/* Args */}
          <div className="mb-2">
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">
              Arguments
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-300">
              {formatArgs(args)}
            </pre>
          </div>

          {/* Result */}
          {hasResult && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                {error ? "Error" : "Result"}
              </p>
              <pre
                className={`overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs ${
                  error ? "text-red-400" : "text-zinc-300"
                }`}
              >
                {error ?? result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
