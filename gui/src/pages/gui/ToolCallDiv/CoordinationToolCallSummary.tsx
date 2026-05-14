import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";

const SUMMARY_LINE_LIMIT = 4;

const COORDINATION_SUMMARY_TOOLS = new Set<string>([
  BuiltInToolNames.Subagent,
  BuiltInToolNames.Config,
  BuiltInToolNames.Status,
  BuiltInToolNames.TeamCreate,
  BuiltInToolNames.TeamDelete,
  BuiltInToolNames.TeamStatus,
  BuiltInToolNames.TeamMailbox,
  BuiltInToolNames.SendMessage,
]);

function asText(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function getSummaryBadges(toolCallState: ToolCallState): string[] {
  const functionName = toolCallState.toolCall.function?.name;
  const args = (toolCallState.parsedArgs ?? {}) as Record<string, unknown>;

  switch (functionName) {
    case BuiltInToolNames.Subagent:
      return [
        asText(args.subagent_name) ? `agent ${args.subagent_name}` : undefined,
        asText(args.team_name) ? `team ${args.team_name}` : undefined,
        asText(args.teammate_name) ? `mate ${args.teammate_name}` : undefined,
        asText(args.profile) ? `profile ${args.profile}` : undefined,
      ].filter((value): value is string => Boolean(value));
    case BuiltInToolNames.Config:
      return [asText(args.setting) ? `setting ${args.setting}` : "config"];
    case BuiltInToolNames.Status:
      return ["runtime status"];
    case BuiltInToolNames.TeamCreate:
      return [
        asText(args.team_name) ? `team ${args.team_name}` : "create team",
      ];
    case BuiltInToolNames.TeamDelete:
      return [
        asText(args.team_name)
          ? `delete ${args.team_name}`
          : "delete active team",
      ];
    case BuiltInToolNames.TeamStatus:
      return [
        asText(args.team_name) ? `team ${args.team_name}` : "active team",
        args.include_mailbox === true ? "with mailbox" : undefined,
        asText(args.member_name) ? `member ${args.member_name}` : undefined,
      ].filter((value): value is string => Boolean(value));
    case BuiltInToolNames.TeamMailbox:
      return [
        asText(args.team_name) ? `team ${args.team_name}` : "active team",
        asText(args.member_name)
          ? `mailbox ${args.member_name}`
          : "mailbox team-lead",
        args.unread_only === true ? "unread only" : undefined,
        args.mark_read === true ? "mark read" : undefined,
      ].filter((value): value is string => Boolean(value));
    case BuiltInToolNames.SendMessage:
      return [
        asText(args.from) ? `from ${args.from}` : "from team-lead",
        asText(args.to) ? `to ${args.to}` : undefined,
        asText(args.kind) ? `kind ${args.kind}` : undefined,
      ].filter((value): value is string => Boolean(value));
    default:
      return [];
  }
}

function getOutputLines(toolCallState: ToolCallState): string[] {
  return (toolCallState.output ?? [])
    .flatMap((item) => item.content.split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isCoordinationSummaryTool(functionName?: string): boolean {
  return Boolean(functionName && COORDINATION_SUMMARY_TOOLS.has(functionName));
}

export function CoordinationToolCallSummary({
  toolCallState,
}: {
  toolCallState: ToolCallState;
}) {
  const badges = getSummaryBadges(toolCallState);
  const outputLines = getOutputLines(toolCallState);
  const previewLines = outputLines.slice(0, SUMMARY_LINE_LIMIT);
  const remainingLineCount = Math.max(
    0,
    outputLines.length - previewLines.length,
  );
  const waitingForOutput =
    toolCallState.status === "generating" ||
    toolCallState.status === "generated" ||
    toolCallState.status === "calling";

  return (
    <div
      className="border-border mt-1 flex flex-col gap-2 rounded-md border px-3 py-2"
      data-testid={`coordination-tool-summary-${toolCallState.toolCallId}`}
    >
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge}
              className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px]"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="text-description flex flex-col gap-1 text-xs">
        {previewLines.length > 0 ? (
          previewLines.map((line, index) => (
            <div
              key={`${toolCallState.toolCallId}-${index}`}
              className="line-clamp-2 whitespace-pre-wrap break-words"
            >
              {line}
            </div>
          ))
        ) : (
          <div className="italic">
            {waitingForOutput
              ? "Waiting for tool output..."
              : "No tool output."}
          </div>
        )}

        {remainingLineCount > 0 && (
          <div className="italic">+{remainingLineCount} more line(s)</div>
        )}
      </div>
    </div>
  );
}
