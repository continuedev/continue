import { Session } from "../index.js";
import { sessionToTraceMarkdown } from "./sessionTrace.js";

const createdAt = new Date("2026-06-18T12:00:00.000Z");

function render(history: Session["history"]) {
  return sessionToTraceMarkdown(
    {
      sessionId: "session-123",
      title: "Trace Test",
      workspaceDirectory: "/workspace",
      history,
    },
    { createdAt },
  );
}

describe("sessionToTraceMarkdown", () => {
  it("renders deterministic session frontmatter and basic message events", () => {
    const trace = render([
      {
        message: {
          role: "user",
          content: "Fix the auth tests",
        },
        contextItems: [
          {
            id: { providerTitle: "file", itemId: "auth.ts" },
            name: "auth.ts",
            description: "src/auth.ts",
            content: "export function auth() {}",
          },
        ],
      },
      {
        message: {
          role: "assistant",
          content: "I'll inspect the failing tests.",
        },
        contextItems: [],
      },
    ]);

    expect(trace).toContain("traceVersion: 1");
    expect(trace).toContain('sessionId: "session-123"');
    expect(trace).toContain('createdAt: "2026-06-18T12:00:00.000Z"');
    expect(trace).toContain("messageCount: 2");
    expect(trace).toContain("## 001 user_message");
    expect(trace).toContain("Fix the auth tests");
    expect(trace).toContain("Context:\n- auth.ts - src/auth.ts");
    expect(trace).toContain("## 002 assistant_message");
    expect(trace).toContain("I'll inspect the failing tests.");
  });

  it("renders reasoning and redacted thinking events", () => {
    const trace = render([
      {
        message: {
          role: "assistant",
          content: "Answer after thinking",
        },
        contextItems: [],
        reasoning: {
          active: false,
          text: "Private chain of thought",
          startAt: 1,
          endAt: 2,
        },
      },
      {
        message: {
          role: "thinking",
          content: "",
          redactedThinking: "encrypted",
        },
        contextItems: [],
      },
    ]);

    expect(trace).toContain("## 002 reasoning\n\nPrivate chain of thought");
    expect(trace).toContain("## 003 reasoning\n\n[redacted]");
  });

  it("renders conversation summaries as summary events", () => {
    const trace = render([
      {
        message: {
          role: "assistant",
          content: "Compacted previous work.",
        },
        contextItems: [],
        conversationSummary: "The previous conversation fixed auth setup.",
      },
    ]);

    expect(trace).toContain("## 001 assistant_message");
    expect(trace).toContain(
      "## 002 summary\n\nThe previous conversation fixed auth setup.",
    );
  });

  it("separates tool calls from successful tool results", () => {
    const trace = render([
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-1",
              type: "function",
              function: {
                name: "runTerminalCommand",
                arguments: '{"cmd":"npm test"}',
              },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-1",
            toolCall: {
              id: "tool-1",
              type: "function",
              function: {
                name: "runTerminalCommand",
                arguments: '{"cmd":"npm test"}',
              },
            },
            status: "done",
            parsedArgs: { cmd: "npm test" },
          },
        ],
      },
      {
        message: {
          role: "tool",
          toolCallId: "tool-1",
          content: "Tests passed",
        },
        contextItems: [],
      },
    ]);

    expect(trace).toContain("## 001 tool_call: runTerminalCommand");
    expect(trace).toContain('"cmd": "npm test"');
    expect(trace).toContain("## 002 tool_result: runTerminalCommand");
    expect(trace).toContain("Success: true");
    expect(trace).toContain("Output:\nTests passed");
    expect(trace).not.toContain("Status: done");
  });

  it("puts failed tool output only in tool_result", () => {
    const trace = render([
      {
        message: {
          role: "assistant",
          content: "",
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-1",
            toolCall: {
              id: "tool-1",
              type: "function",
              function: {
                name: "runTerminalCommand",
                arguments: '{"cmd":"npm test"}',
              },
            },
            status: "errored",
            parsedArgs: { cmd: "npm test" },
            output: [
              {
                name: "Tool Call Error",
                description: "Tool Call Failed",
                content: "runTerminalCommand failed with exit code 1",
              },
            ],
          },
        ],
      },
    ]);

    const toolCallSection = trace.slice(
      trace.indexOf("## 001 tool_call"),
      trace.indexOf("## 002 tool_result"),
    );
    expect(toolCallSection).not.toContain("Success:");
    expect(toolCallSection).not.toContain("failed with exit code 1");
    expect(trace).toContain("## 002 tool_result: runTerminalCommand");
    expect(trace).toContain("Success: false");
    expect(trace).toContain("runTerminalCommand failed with exit code 1");
  });

  it("renders unknown success for tool results without matching tool call state", () => {
    const trace = render([
      {
        message: {
          role: "tool",
          toolCallId: "missing-tool-state",
          content: "Detached tool output",
        },
        contextItems: [],
      },
    ]);

    expect(trace).toContain("## 001 tool_result: unknownTool");
    expect(trace).toContain("Tool Call ID: missing-tool-state");
    expect(trace).toContain("Success: unknown");
    expect(trace).toContain("Detached tool output");
  });
});
