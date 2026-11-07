import type { Session, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it } from "vitest";
import sessionReducer, {
  INITIAL_SESSION_STATE,
  newSession,
} from "../../redux/slices/sessionSlice";
import { INTERRUPTED_REASON } from "./interrupt";

function call(
  id: string,
  status: ToolCallState["status"],
  runStatus: NonNullable<ToolCallState["subagent"]>["status"],
): ToolCallState {
  return {
    toolCallId: id,
    status,
    parsedArgs: {},
    toolCall: {
      id,
      type: "function",
      function: { name: BuiltInToolNames.Subagent, arguments: "{}" },
    },
    subagent: {
      agent: "Explore",
      prompt: "p",
      status: runStatus,
      text: "found a.ts",
      toolCalls: [
        { name: "grep_search", summary: "foo", status: "done" },
        { name: "read_file", summary: "a.ts", status: "calling" },
      ],
      pendingApproval:
        runStatus === "running"
          ? { id: "x", toolName: "ls", summary: "" }
          : undefined,
    },
  };
}

function load(calls: ToolCallState[]) {
  const session: Session = {
    sessionId: "s",
    title: "t",
    workspaceDirectory: "",
    history: [
      { message: { role: "user", content: "hi" }, contextItems: [] },
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: calls.map((c) => c.toolCall),
        },
        contextItems: [],
        toolCallStates: calls,
      },
    ],
  };
  const state = sessionReducer(
    { ...INITIAL_SESSION_STATE, streamAborter: new AbortController() },
    newSession(session),
  );
  return state.history[1].toolCallStates!;
}

describe("loading a session with subagent runs", () => {
  it("marks a run saved while running as interrupted and ends its tool call with what it found", () => {
    const [running, queued, done] = load([
      call("a", "calling", "running"),
      call("b", "calling", "queued"),
      call("c", "done", "completed"),
    ]);

    expect(running.subagent!.status).toBe("interrupted");
    expect(running.subagent!.error).toBe(INTERRUPTED_REASON);
    expect(running.subagent!.pendingApproval).toBeUndefined();
    expect(running.subagent!.toolCalls[1].status).toBe("canceled");
    expect(running.status).toBe("done");
    const content = running.output![0].content;
    expect(content).toContain("found a.ts");
    expect(content).toContain("status: interrupted");

    expect(queued.subagent!.status).toBe("interrupted");
    // A finished run is left as it was
    expect(done.subagent!.status).toBe("completed");
    expect(done.output).toBeUndefined();
  });
});
