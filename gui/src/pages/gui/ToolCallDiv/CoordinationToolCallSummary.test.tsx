import { render, screen } from "@testing-library/react";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it } from "vitest";

import { CoordinationToolCallSummary } from "./CoordinationToolCallSummary";

function createToolCallState(args: {
  toolCallId: string;
  functionName: string;
  status?: ToolCallState["status"];
  parsedArgs?: Record<string, unknown>;
  output?: Array<{ name: string; description: string; content: string }>;
}): ToolCallState {
  return {
    toolCallId: args.toolCallId,
    status: args.status ?? "done",
    toolCall: {
      id: args.toolCallId,
      type: "function",
      function: {
        name: args.functionName,
        arguments: JSON.stringify(args.parsedArgs ?? {}),
      },
    },
    parsedArgs: args.parsedArgs ?? {},
    output: args.output ?? [],
  };
}

describe("CoordinationToolCallSummary", () => {
  it("renders subagent team badges and an inline output preview", () => {
    render(
      <CoordinationToolCallSummary
        toolCallState={createToolCallState({
          toolCallId: "subagent-1",
          functionName: BuiltInToolNames.Subagent,
          parsedArgs: {
            subagent_name: "Explore",
            team_name: "Coordination",
            teammate_name: "investigator",
            profile: "verify",
          },
          output: [
            {
              name: "Subagent Result",
              description: "stopReason=done; turns=3",
              content:
                "Subagent task: Trace the routing\n\nMapped the owning files.\nFound the core dispatcher.",
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("agent Explore")).toBeInTheDocument();
    expect(screen.getByText("team Coordination")).toBeInTheDocument();
    expect(screen.getByText("mate investigator")).toBeInTheDocument();
    expect(screen.getByText("profile verify")).toBeInTheDocument();
    expect(screen.getByText("Mapped the owning files.")).toBeInTheDocument();
    expect(screen.getByText("Found the core dispatcher.")).toBeInTheDocument();
  });

  it("renders mailbox-specific badges and the waiting state before output arrives", () => {
    render(
      <CoordinationToolCallSummary
        toolCallState={createToolCallState({
          toolCallId: "mailbox-1",
          functionName: BuiltInToolNames.TeamMailbox,
          status: "calling",
          parsedArgs: {
            team_name: "Coordination",
            member_name: "reviewer",
            unread_only: true,
            mark_read: true,
          },
        })}
      />,
    );

    expect(screen.getByText("team Coordination")).toBeInTheDocument();
    expect(screen.getByText("mailbox reviewer")).toBeInTheDocument();
    expect(screen.getByText("unread only")).toBeInTheDocument();
    expect(screen.getByText("mark read")).toBeInTheDocument();
    expect(screen.getByText("Waiting for tool output...")).toBeInTheDocument();
  });
});
