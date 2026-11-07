import type { SubAgentResult } from "./executor.js";
import { formatToolCall, neutralizeHarnessTags } from "./transcript.js";

/**
 * An AbortController for a subagent run that aborts when the parent turn's
 * signal does. `dispose` removes the listener once the run is over.
 */
export function linkedAbortController(parent?: AbortSignal): {
  controller: AbortController;
  dispose: () => void;
} {
  const controller = new AbortController();
  if (!parent) return { controller, dispose: () => {} };
  if (parent.aborted) {
    controller.abort(parent.reason);
    return { controller, dispose: () => {} };
  }
  const onAbort = () => controller.abort(parent.reason);
  parent.addEventListener("abort", onAbort, { once: true });
  return {
    controller,
    dispose: () => parent.removeEventListener("abort", onAbort),
  };
}

/**
 * What the parent model reads back from a subagent: its answer (or what it
 * wrote before it stopped), then the run's status, the reason it did not
 * complete, and the tools it used by name. Tool output is never included,
 * and tags in the subagent's text that imitate the ones framing the result
 * are escaped, since that text is untrusted data.
 */
export function formatSubagentResult(
  agentName: string,
  result: SubAgentResult,
): string {
  const response = neutralizeHarnessTags(result.response.trim());
  const metadata = [
    `agent: ${neutralizeHarnessTags(agentName)}`,
    `status: ${result.status}`,
  ];
  if (result.error) {
    metadata.push(`reason: ${neutralizeHarnessTags(result.error)}`);
  }
  if (result.toolCalls.length > 0) {
    metadata.push(`tool calls (${result.toolCalls.length}):`);
    for (const call of result.toolCalls) {
      metadata.push(`- ${neutralizeHarnessTags(formatToolCall(call))}`);
    }
  }
  return [
    response || "(the subagent returned no text)",
    "<task_metadata>",
    ...metadata,
    "</task_metadata>",
  ].join("\n");
}
