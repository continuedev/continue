import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it, vi } from "vitest";

import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { CoordinationToolCallSummary } from "./CoordinationToolCallSummary";

function createToolCallState(args: {
  toolCallId: string;
  functionName: string;
  status?: ToolCallState["status"];
  parsedArgs?: Record<string, unknown>;
  output?: ToolCallState["output"];
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

  it("surfaces mailbox handoff provenance for subagent tool summaries", () => {
    render(
      <CoordinationToolCallSummary
        toolCallState={createToolCallState({
          toolCallId: "subagent-handoff-1",
          functionName: BuiltInToolNames.Subagent,
          parsedArgs: {
            subagent_name: "Explore",
            teammate_name: "investigator",
          },
          output: [
            {
              name: "Mailbox Handoff",
              description: "2 claimed message(s) for investigator",
              content:
                "Consumed 2 mailbox handoff message(s) for investigator in team Coordination:\n- [prompt] team-lead @ 2026-05-14T00:00:00.000Z -- Primary handoff\nTrace the auth flow from UI entry to token storage.",
            },
            {
              name: "Subagent Result",
              description: "stopReason=done; turns=4",
              content:
                "Subagent task: Map the implementation\n\nCompleted the delegated work.",
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByText(/Consumed 2 mailbox handoff message\(s\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Trace the auth flow from UI entry to token storage\./),
    ).toBeInTheDocument();
  });

  it("renders structured mailbox message status in transcript summaries", () => {
    render(
      <CoordinationToolCallSummary
        toolCallState={createToolCallState({
          toolCallId: "mailbox-summary-1",
          functionName: BuiltInToolNames.TeamMailbox,
          parsedArgs: {
            member_name: "investigator",
            unread_only: true,
          },
          output: [
            {
              name: "Team Mailbox",
              description: "Mailbox investigator",
              content:
                "Mailbox for investigator in Coordination (1 message(s)):\n- [prompt] team-lead @ 2026-05-14T00:05:00.000Z -- Needs review\nNeeds review before merge.",
              metadata: {
                teamName: "Coordination",
                mailboxOwner: "investigator",
                totalMessages: 1,
                unreadCount: 0,
                truncated: false,
                messages: [
                  {
                    id: "msg-investigator-1",
                    from: "team-lead",
                    text: "Needs review before merge.",
                    timestamp: "2026-05-14T00:05:00.000Z",
                    summary: "Needs review",
                    kind: "prompt",
                    read: true,
                    readAt: "2026-05-14T00:06:00.000Z",
                    readSource: "panel_subagent_delegate",
                    readBy: "investigator",
                  },
                ],
              },
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByText("[prompt] team-lead -- Needs review"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Consumed by investigator at 2026-05-14T00:06:00.000Z"),
    ).toBeInTheDocument();
    expect(screen.getByText("Needs review before merge.")).toBeInTheDocument();
  });

  it("delegates mailbox items directly from the transcript summary card", async () => {
    const user = userEvent.setup();
    const mockIdeMessenger = new MockIdeMessenger();
    const toolsCallHandler = vi.fn(async (data: any) => {
      const functionName = data.toolCall.function.name;
      const args = JSON.parse(data.toolCall.function.arguments);

      if (
        functionName === BuiltInToolNames.TeamMailbox &&
        args.mark_read === true
      ) {
        return {
          contextItems: [
            {
              name: "Team Mailbox",
              description: "Mailbox investigator",
              content:
                "Mailbox for investigator in Coordination (1 message(s)):\n- [prompt] team-lead @ 2026-05-14T00:05:00.000Z -- Needs review\nNeeds review before merge.",
              metadata: {
                teamName: "Coordination",
                mailboxOwner: "investigator",
                totalMessages: 1,
                unreadCount: 0,
                truncated: false,
                messages: [
                  {
                    id: "msg-investigator-1",
                    from: "team-lead",
                    text: "Needs review before merge.",
                    timestamp: "2026-05-14T00:05:00.000Z",
                    summary: "Needs review",
                    kind: "prompt",
                    read: true,
                    readAt: "2026-05-14T00:06:00.000Z",
                    readSource: "panel_subagent_delegate",
                    readBy: "investigator",
                  },
                ],
              },
            },
          ],
          errorMessage: undefined,
        };
      }

      if (functionName === BuiltInToolNames.TeamStatus) {
        return {
          contextItems: [
            {
              name: "Team Status",
              description: "Team Coordination",
              content:
                "Team Coordination\nLead: team-lead\nMembers:\n- team-lead: idle\n- investigator (Explore): idle, unread=1",
            },
          ],
          errorMessage: undefined,
        };
      }

      if (functionName === BuiltInToolNames.Subagent) {
        return {
          contextItems: [
            {
              name: "Subagent Result",
              description: "stopReason=done; turns=2",
              content:
                "Subagent task: Handle this mailbox handoff\n\nReviewed the merge path and wrote the handoff notes.",
            },
          ],
          errorMessage: undefined,
        };
      }

      return {
        contextItems: [],
        errorMessage: undefined,
      };
    });
    mockIdeMessenger.responseHandlers["tools/call"] = toolsCallHandler;

    render(
      <CoordinationToolCallSummary
        toolCallState={createToolCallState({
          toolCallId: "mailbox-delegate-1",
          functionName: BuiltInToolNames.TeamMailbox,
          parsedArgs: {
            member_name: "investigator",
            unread_only: true,
          },
          output: [
            {
              name: "Team Mailbox",
              description: "Mailbox investigator",
              content:
                "Mailbox for investigator in Coordination (1 message(s)):\n- [prompt] team-lead @ 2026-05-14T00:05:00.000Z -- Needs review\nNeeds review before merge.",
              metadata: {
                teamName: "Coordination",
                mailboxOwner: "investigator",
                totalMessages: 1,
                unreadCount: 1,
                truncated: false,
                messages: [
                  {
                    id: "msg-investigator-1",
                    from: "team-lead",
                    text: "Needs review before merge.",
                    timestamp: "2026-05-14T00:05:00.000Z",
                    summary: "Needs review",
                    kind: "prompt",
                    read: false,
                  },
                ],
              },
            },
          ],
        })}
        ideMessenger={mockIdeMessenger}
        sessionId="session-current"
      />,
    );

    await user.click(
      screen.getByTestId(
        "coordination-mailbox-delegate-mailbox-delegate-1-msg-investigator-1",
      ),
    );

    await waitFor(() => {
      const subagentCall = toolsCallHandler.mock.calls
        .map(([payload]) => payload)
        .find((payload) => {
          if (payload.toolCall.function.name !== BuiltInToolNames.Subagent) {
            return false;
          }

          const parsed = JSON.parse(payload.toolCall.function.arguments);
          return (
            parsed.teammate_name === "investigator" &&
            parsed.subagent_name === "Explore" &&
            parsed.prompt.includes("Needs review before merge.")
          );
        });

      expect(subagentCall).toBeDefined();
    });

    expect(
      screen.getByText("Consumed by investigator at 2026-05-14T00:06:00.000Z"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        "coordination-mailbox-delegate-result-mailbox-delegate-1-msg-investigator-1",
      ),
    ).toHaveTextContent("Reviewed the merge path and wrote the handoff notes.");
  });
});
