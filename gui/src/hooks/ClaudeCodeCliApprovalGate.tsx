import { ToolCallState } from "core";
import { useContext, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppSelector } from "../redux/hooks";
import { evaluateToolPolicy } from "../redux/thunks/evaluateToolPolicies";
import { useWebviewListener } from "./useWebviewListener";

interface PendingApproval {
  approvalId: string;
  toolName: string;
  displayTitle?: string;
  wouldLikeTo?: string;
  args: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

/**
 * Answers "claudeCodeCli/authorizeToolCall" requests sent by the in-core
 * shadow-code-tools MCP server (core/mcp/shadowCodeToolsServer.ts) whenever a
 * Claude Code CLI-driven tool call needs a policy decision. Reuses the same
 * evaluateToolPolicy logic and toolSettings the normal agent tool-call flow
 * uses, so a tool the user has configured as auto-approved/disabled behaves
 * identically whether it was called by the normal chat loop or by Claude
 * Code CLI. Only "allowedWithPermission" tools actually block on this
 * component's banner UI.
 */
function ClaudeCodeCliApprovalGate() {
  const ideMessenger = useContext(IdeMessengerContext);
  const tools = useAppSelector((store) => store.config.config.tools);
  const toolPolicies = useAppSelector((store) => store.ui.toolSettings);
  const [pending, setPending] = useState<PendingApproval[]>([]);

  useWebviewListener(
    "claudeCodeCli/authorizeToolCall",
    async (data) => {
      const syntheticToolCallState: ToolCallState = {
        toolCallId: data.approvalId,
        status: "generated",
        parsedArgs: data.args,
        toolCall: {
          id: data.approvalId,
          type: "function",
          function: {
            name: data.toolName,
            arguments: JSON.stringify(data.args),
          },
        },
      };

      const { policy } = await evaluateToolPolicy(
        ideMessenger,
        tools,
        syntheticToolCallState,
        toolPolicies,
      );

      if (policy === "allowedWithoutPermission") {
        return { approved: true };
      }
      if (policy === "disabled") {
        return { approved: false };
      }

      // allowedWithPermission: block until the user clicks Allow/Deny below.
      return new Promise<{ approved: boolean }>((resolve) => {
        setPending((prev) => [
          ...prev,
          {
            approvalId: data.approvalId,
            toolName: data.toolName,
            displayTitle: data.displayTitle,
            wouldLikeTo: data.wouldLikeTo,
            args: data.args,
            resolve: (approved) => resolve({ approved }),
          },
        ]);
      });
    },
    [tools, toolPolicies, ideMessenger],
  );

  function resolvePending(approvalId: string, approved: boolean) {
    setPending((prev) => {
      prev.find((p) => p.approvalId === approvalId)?.resolve(approved);
      return prev.filter((p) => p.approvalId !== approvalId);
    });
  }

  if (pending.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {pending.map((p) => (
        <div
          key={p.approvalId}
          className="bg-vsc-editor-background border-vsc-input-border w-80 rounded-md border p-3 shadow-lg"
        >
          <div className="text-sm font-medium">
            Claude Code wants to {p.wouldLikeTo ?? p.toolName}
          </div>
          <div className="text-description mt-1 truncate text-xs">
            {p.displayTitle ?? p.toolName}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="rounded border px-2 py-1 text-xs"
              onClick={() => resolvePending(p.approvalId, false)}
            >
              Deny
            </button>
            <button
              className="bg-vsc-button-background text-vsc-button-foreground rounded px-2 py-1 text-xs"
              onClick={() => resolvePending(p.approvalId, true)}
            >
              Allow
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ClaudeCodeCliApprovalGate;
