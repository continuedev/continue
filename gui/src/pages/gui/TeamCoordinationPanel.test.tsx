import { screen, waitFor } from "@testing-library/react";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it, vi } from "vitest";

import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { renderWithProviders } from "../../util/test/render";
import { TeamCoordinationPanel } from "./TeamCoordinationPanel";

describe("TeamCoordinationPanel", () => {
  it("loads team status and lead mailbox content, then marks unread items as read", async () => {
    const mockIdeMessenger = new MockIdeMessenger();
    const mailboxes: Record<string, any[]> = {
      "team-lead": [
        {
          id: "msg-lead-1",
          from: "investigator",
          text: "Mapped the owning files.",
          timestamp: "2026-05-14T00:00:00.000Z",
          summary: "Routing mapped",
          kind: "message",
          read: false,
        },
        {
          id: "msg-lead-2",
          from: "reviewer",
          text: "Need a quick signoff.",
          timestamp: "2026-05-14T00:01:00.000Z",
          summary: "Signoff",
          kind: "message",
          read: false,
        },
      ],
      investigator: [
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
    };

    function buildMailboxContextItem(owner: string) {
      const messages = mailboxes[owner] ?? [];
      return {
        name: "Team Mailbox",
        description: `Mailbox ${owner}`,
        content:
          messages.length > 0
            ? `Mailbox for ${owner} in Coordination (${messages.length} message(s)):\n${messages
                .map(
                  (message) =>
                    `- [${message.kind}] ${message.from} @ ${message.timestamp}${message.summary ? ` -- ${message.summary}` : ""}\n${message.text}`,
                )
                .join("\n")}`
            : `Mailbox for ${owner} in Coordination is empty.`,
        metadata: {
          teamName: "Coordination",
          mailboxOwner: owner,
          totalMessages: messages.length,
          unreadCount: messages.filter((message) => !message.read).length,
          truncated: false,
          messages,
        },
      };
    }

    const toolsCallHandler = vi.fn(async (data: any) => {
      const functionName = data.toolCall.function.name;
      const args = JSON.parse(data.toolCall.function.arguments);

      if (functionName === BuiltInToolNames.TeamStatus) {
        return {
          contextItems: [
            {
              name: "Team Status",
              description: "Team Coordination",
              content:
                "Team Coordination\nLead: team-lead\nMembers:\n- team-lead: idle\n- investigator (Explore): running, unread=2",
            },
          ],
          errorMessage: undefined,
        };
      }

      if (functionName === BuiltInToolNames.TeamMailbox) {
        const owner = args.member_name ?? "team-lead";

        if (args.mark_read === true) {
          const selectedIds = Array.isArray(args.message_ids)
            ? new Set(args.message_ids)
            : null;
          mailboxes[owner] = (mailboxes[owner] ?? []).map((message) =>
            message.read || (selectedIds && !selectedIds.has(message.id))
              ? message
              : {
                  ...message,
                  read: true,
                  readAt: "2026-05-14T00:06:00.000Z",
                  readSource: args.read_source ?? "team_mailbox",
                  readBy: args.read_by ?? owner,
                },
          );
        }

        return {
          contextItems: [buildMailboxContextItem(owner)],
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
                "Subagent task: Handle this mailbox handoff\n\nReviewed the mailbox task and prepared the merge notes.",
            },
          ],
          errorMessage: undefined,
        };
      }

      return {
        contextItems: [buildMailboxContextItem("team-lead")],
        errorMessage: undefined,
      };
    });
    mockIdeMessenger.responseHandlers["tools/call"] = toolsCallHandler;

    const initialState = getEmptyRootState();
    initialState.session.id = "session-current";

    const { user } = await renderWithProviders(<TeamCoordinationPanel />, {
      store: createMockStore(initialState, mockIdeMessenger),
      mockIdeMessenger,
    });

    await waitFor(() => {
      expect(screen.getByTestId("team-coordination-panel")).toBeInTheDocument();
    });

    expect(screen.getByText("Team coordination")).toBeInTheDocument();
    expect(screen.getAllByText(/Team Coordination/).length).toBeGreaterThan(0);
    expect(screen.getByText("Mailbox")).toBeInTheDocument();
    expect(screen.getByText(/2\s+unread/)).toBeInTheDocument();
    expect(
      screen.getByTestId("team-coordination-message-msg-lead-1"),
    ).toHaveTextContent("Mapped the owning files.");
    expect(screen.getByTestId("team-coordination-mailbox-owner")).toHaveValue(
      "team-lead",
    );
    expect(toolsCallHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-current",
      }),
    );

    await user.selectOptions(
      screen.getByTestId("team-coordination-mailbox-owner"),
      "investigator",
    );

    await waitFor(() => {
      expect(screen.getByTestId("team-coordination-mailbox-owner")).toHaveValue(
        "investigator",
      );
    });
    expect(screen.getByText(/1\s+unread/)).toBeInTheDocument();
    expect(
      screen.getByTestId("team-coordination-message-msg-investigator-1"),
    ).toHaveTextContent("Needs review before merge.");
    expect(
      screen.getByTestId("team-coordination-delegate-msg-investigator-1"),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("team-coordination-mark-read"));

    await waitFor(() => {
      const markReadCall = toolsCallHandler.mock.calls
        .map(([payload]) => payload)
        .find((payload) => {
          if (payload.toolCall.function.name !== BuiltInToolNames.TeamMailbox) {
            return false;
          }

          const parsed = JSON.parse(payload.toolCall.function.arguments);
          return (
            parsed.member_name === "investigator" && parsed.mark_read === true
          );
        });

      expect(markReadCall).toBeDefined();
    });
    expect(screen.getByText(/0\s+unread/)).toBeInTheDocument();
    expect(
      screen.getByTestId("team-coordination-message-msg-investigator-1"),
    ).toHaveTextContent("Read at 2026-05-14T00:06:00.000Z");
  });

  it("delegates a selected mailbox handoff directly to the selected teammate", async () => {
    const mockIdeMessenger = new MockIdeMessenger();
    const mailboxes: Record<string, any[]> = {
      investigator: [
        {
          id: "msg-investigator-1",
          from: "team-lead",
          text: "Trace the auth flow before merge.",
          timestamp: "2026-05-14T00:05:00.000Z",
          summary: "Auth review",
          kind: "prompt",
          read: false,
        },
      ],
    };

    function buildMailboxContextItem(owner: string) {
      const messages = mailboxes[owner] ?? [];
      return {
        name: "Team Mailbox",
        description: `Mailbox ${owner}`,
        content:
          messages.length > 0
            ? `Mailbox for ${owner} in Coordination (${messages.length} message(s)):`
            : `Mailbox for ${owner} in Coordination is empty.`,
        metadata: {
          teamName: "Coordination",
          mailboxOwner: owner,
          totalMessages: messages.length,
          unreadCount: messages.filter((message) => !message.read).length,
          truncated: false,
          messages,
        },
      };
    }

    const toolsCallHandler = vi.fn(async (data: any) => {
      const functionName = data.toolCall.function.name;
      const args = JSON.parse(data.toolCall.function.arguments);

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

      if (functionName === BuiltInToolNames.TeamMailbox) {
        if (args.mark_read === true) {
          mailboxes.investigator = mailboxes.investigator.map((message) => ({
            ...message,
            read: true,
            readAt: "2026-05-14T00:06:00.000Z",
            readSource: args.read_source,
            readBy: args.read_by,
          }));
        }

        return {
          contextItems: [buildMailboxContextItem("investigator")],
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
                "Subagent task: Handle this mailbox handoff\n\nReviewed the auth flow and documented the merge risks.",
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

    const initialState = getEmptyRootState();
    initialState.session.id = "session-current";

    const { user } = await renderWithProviders(<TeamCoordinationPanel />, {
      store: createMockStore(initialState, mockIdeMessenger),
      mockIdeMessenger,
    });

    await waitFor(() => {
      expect(screen.getByTestId("team-coordination-panel")).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByTestId("team-coordination-mailbox-owner"),
      "investigator",
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("team-coordination-delegate-msg-investigator-1"),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByTestId("team-coordination-delegate-msg-investigator-1"),
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
            parsed.prompt.includes("Trace the auth flow before merge.")
          );
        });

      expect(subagentCall).toBeDefined();
    });

    expect(
      screen.getByTestId("team-coordination-message-msg-investigator-1"),
    ).toHaveTextContent("Consumed by investigator");
    expect(
      screen.getByTestId("team-coordination-message-msg-investigator-1"),
    ).toHaveTextContent("Consumed by investigator at 2026-05-14T00:06:00.000Z");
    expect(
      screen.getByTestId(
        "team-coordination-delegate-result-msg-investigator-1",
      ),
    ).toHaveTextContent(
      "Reviewed the auth flow and documented the merge risks.",
    );
  });

  it("stays hidden when no active team exists for the session", async () => {
    const mockIdeMessenger = new MockIdeMessenger();
    mockIdeMessenger.responseHandlers["tools/call"] = vi.fn(async () => ({
      contextItems: [],
      errorMessage: "No active team exists for this session.",
    }));

    const initialState = getEmptyRootState();
    initialState.session.id = "session-current";

    await renderWithProviders(<TeamCoordinationPanel />, {
      store: createMockStore(initialState, mockIdeMessenger),
      mockIdeMessenger,
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId("team-coordination-panel"),
      ).not.toBeInTheDocument();
    });
  });
});
