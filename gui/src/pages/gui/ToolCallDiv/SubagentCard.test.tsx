import { fireEvent, render, screen } from "@testing-library/react";
import type { SubagentRunState, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../util/subagents/registry", () => ({
  stopSubagentRun: vi.fn(),
  answerSubagentApproval: vi.fn(),
}));

import {
  answerSubagentApproval,
  stopSubagentRun,
} from "../../../util/subagents/registry";
import { SubagentCard } from "./SubagentCard";

const ID = "call-1";

function callWith(
  run: Partial<SubagentRunState> | undefined,
  status: ToolCallState["status"] = "calling",
): ToolCallState {
  const args = {
    agent: "Explore",
    description: "find foo",
    prompt: "Find every use of foo and report the files.",
  };
  return {
    toolCallId: ID,
    status,
    parsedArgs: args,
    toolCall: {
      id: ID,
      type: "function",
      function: {
        name: BuiltInToolNames.Subagent,
        arguments: JSON.stringify(args),
      },
    },
    subagent: run && {
      agent: "Explore",
      prompt: args.prompt,
      description: args.description,
      status: "running",
      toolCalls: [],
      text: "",
      ...run,
    },
  };
}

const status = () => screen.getByTestId(`subagent-status-${ID}`).textContent;

describe("SubagentCard", () => {
  it("shows a running run: name, model, tools as they happen, and Stop", () => {
    render(
      <SubagentCard
        toolCallState={callWith({
          model: "Claude Sonnet",
          toolCalls: [
            { name: "grep_search", summary: "foo", status: "done" },
            { name: "read_file", summary: "src/a.ts", status: "calling" },
          ],
          usage: { inputTokens: 1200, outputTokens: 300 },
        })}
      />,
    );
    expect(screen.getByText("Explore")).toBeTruthy();
    expect(screen.getByText("find foo")).toBeTruthy();
    expect(status()).toBe("Running");
    expect(screen.getByText("Claude Sonnet")).toBeTruthy();
    expect(screen.getByText("1.5k tokens")).toBeTruthy();
    const tools = screen.getByTestId(`subagent-tools-${ID}`);
    expect(tools.textContent).toContain("grep_search foo");
    expect(tools.textContent).toContain("read_file src/a.ts");

    fireEvent.click(screen.getByTestId(`subagent-stop-${ID}`));
    expect(stopSubagentRun).toHaveBeenCalledWith(ID);
  });

  it("keeps the prompt collapsed until asked", () => {
    render(<SubagentCard toolCallState={callWith({})} />);
    expect(screen.queryByTestId(`subagent-prompt-${ID}`)).toBeNull();
    fireEvent.click(screen.getByTestId(`subagent-prompt-toggle-${ID}`));
    expect(screen.getByTestId(`subagent-prompt-${ID}`).textContent).toBe(
      "Find every use of foo and report the files.",
    );
  });

  it("shows the answer of a finished run, collapsible, and no Stop", () => {
    render(
      <SubagentCard
        toolCallState={callWith(
          { status: "completed", text: "foo is used in a.ts:3" },
          "done",
        )}
      />,
    );
    expect(status()).toBe("Done");
    expect(screen.queryByTestId(`subagent-stop-${ID}`)).toBeNull();
    expect(screen.getByTestId(`subagent-answer-${ID}`).textContent).toBe(
      "foo is used in a.ts:3",
    );
    fireEvent.click(screen.getByTestId(`subagent-answer-toggle-${ID}`));
    expect(screen.queryByTestId(`subagent-answer-${ID}`)).toBeNull();
  });

  it.each([
    ["failed", "Failed", "Bedrock throttled the request"],
    ["cancelled", "Cancelled", "Stopped by the user"],
    ["interrupted", "Interrupted", "The window was reloaded while it ran"],
    ["partial", "Stopped at turn limit", "Stopped after 30 model calls"],
  ] as const)("shows a %s run with its reason", (runStatus, label, error) => {
    render(
      <SubagentCard
        toolCallState={callWith(
          { status: runStatus, error, text: "what it found so far" },
          "done",
        )}
      />,
    );
    expect(status()).toBe(label);
    expect(screen.getByText(error)).toBeTruthy();
    expect(screen.getByText("Output so far")).toBeTruthy();
    expect(screen.queryByTestId(`subagent-stop-${ID}`)).toBeNull();
  });

  it("asks for approval labelled with the agent's name", () => {
    render(
      <SubagentCard
        toolCallState={callWith({
          agent: "runner",
          pendingApproval: {
            id: "approval-1",
            toolName: "run_terminal_command",
            summary: "rm -rf build",
            note: "Matches ask rule runTerminalCommand(rm *)",
          },
        })}
      />,
    );
    const approval = screen.getByTestId(`subagent-approval-${ID}`);
    expect(approval.textContent).toContain(
      "runner wants to run run_terminal_command rm -rf build",
    );
    expect(approval.textContent).toContain("Matches ask rule");
    fireEvent.click(screen.getByTestId(`subagent-reject-${ID}`));
    expect(answerSubagentApproval).toHaveBeenCalledWith("approval-1", false);
    fireEvent.click(screen.getByTestId(`subagent-accept-${ID}`));
    expect(answerSubagentApproval).toHaveBeenCalledWith("approval-1", true);
  });

  it("shows a call that has not started from its arguments", () => {
    render(<SubagentCard toolCallState={callWith(undefined, "generated")} />);
    expect(screen.getByText("Explore")).toBeTruthy();
    expect(status()).toBe("Starting");
    expect(screen.queryByTestId(`subagent-stop-${ID}`)).toBeNull();
  });

  it("says a rejected call never started", () => {
    render(<SubagentCard toolCallState={callWith(undefined, "canceled")} />);
    expect(status()).toBe("Not started");
  });
});
