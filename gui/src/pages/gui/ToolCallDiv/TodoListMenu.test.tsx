import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it } from "vitest";
import {
  findLatestTodoToolCallStateInCurrentTurn,
  getActiveTodoTaskLabel,
  TodoListMenu,
} from "./TodoListMenu";

function createTodoWriteCallState(): ToolCallState {
  return {
    toolCallId: "todo-call-1",
    status: "done",
    toolCall: {
      id: "todo-call-1",
      type: "function",
      function: {
        name: "todo_write",
        arguments: "{}",
      },
    },
    parsedArgs: {
      todos: [
        {
          id: "read-log",
          content: "Read and analyze startup log file",
          status: "in_progress",
          priority: "high",
        },
        {
          id: "explore-gateway",
          content: "Explore binance-gateway crate structure",
          status: "pending",
          priority: "medium",
        },
        {
          id: "explore-warden",
          content: "Explore position-warden crate structure",
          status: "pending",
          priority: "medium",
        },
        {
          id: "cross-reference",
          content: "Cross-reference findings with codebase",
          status: "pending",
          priority: "medium",
        },
        {
          id: "write-report",
          content: "Produce findings report",
          status: "pending",
          priority: "low",
        },
      ],
    },
    output: [],
  };
}

describe("TodoListMenu", () => {
  it("renders a todo menu with progress and items", () => {
    render(<TodoListMenu toolCallState={createTodoWriteCallState()} />);

    expect(screen.getByTestId("todo-list-menu-header")).toHaveTextContent(
      "Todos (1/5)",
    );
    expect(screen.getByTestId("todo-list-menu-items")).toBeInTheDocument();
    expect(
      screen.getByText("Read and analyze startup log file"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Explore binance-gateway crate structure"),
    ).toBeInTheDocument();
  });

  it("lets users collapse and expand the todo menu", async () => {
    const user = userEvent.setup();

    render(<TodoListMenu toolCallState={createTodoWriteCallState()} />);

    const header = screen.getByTestId("todo-list-menu-header");
    const body = screen.getByTestId("todo-list-menu-body");

    expect(header).toHaveAttribute("aria-expanded", "true");

    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(body.className).toContain("max-h-0");

    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(body.className).toContain("max-h-[40vh]");
  });

  it("returns the in-progress task label for toolbar status text", () => {
    const label = getActiveTodoTaskLabel(createTodoWriteCallState());

    expect(label).toBe("Read and analyze startup log file");
  });

  it("keeps the latest todo tool call in the current turn", () => {
    const todoCallState = createTodoWriteCallState();

    const history = [
      {
        message: { role: "assistant" },
        toolCallStates: [todoCallState],
      },
      {
        message: { role: "assistant" },
        toolCallStates: [
          {
            toolCallId: "read-call-1",
            status: "calling",
            toolCall: {
              id: "read-call-1",
              type: "function",
              function: {
                name: BuiltInToolNames.ReadFile,
                arguments: "{}",
              },
            },
            parsedArgs: {
              filePath: "/workspace/src/test.ts",
            },
            output: [],
          },
        ],
      },
    ] as any;

    const latestTodoToolCall =
      findLatestTodoToolCallStateInCurrentTurn(history);

    expect(latestTodoToolCall?.toolCallId).toBe("todo-call-1");
  });

  it("keeps previous todos while a newer todo call is still in flight", () => {
    const stableTodoCall = createTodoWriteCallState();
    const streamingTodoCall: ToolCallState = {
      toolCallId: "todo-call-2",
      status: "calling",
      toolCall: {
        id: "todo-call-2",
        type: "function",
        function: {
          name: BuiltInToolNames.TodoWrite,
          arguments: "{}",
        },
      },
      parsedArgs: {},
      output: [],
    };

    const history = [
      {
        message: { role: "assistant" },
        toolCallStates: [stableTodoCall],
      },
      {
        message: { role: "assistant" },
        toolCallStates: [streamingTodoCall],
      },
    ] as any;

    const latestTodoToolCall =
      findLatestTodoToolCallStateInCurrentTurn(history);

    expect(latestTodoToolCall?.toolCallId).toBe("todo-call-1");
  });

  it("uses the latest completed todo call when it intentionally clears todos", () => {
    const stableTodoCall = createTodoWriteCallState();
    const clearedTodoCall: ToolCallState = {
      toolCallId: "todo-call-2",
      status: "done",
      toolCall: {
        id: "todo-call-2",
        type: "function",
        function: {
          name: BuiltInToolNames.TodoWrite,
          arguments: "{}",
        },
      },
      parsedArgs: { todos: [] },
      output: [],
    };

    const history = [
      {
        message: { role: "assistant" },
        toolCallStates: [stableTodoCall],
      },
      {
        message: { role: "assistant" },
        toolCallStates: [clearedTodoCall],
      },
    ] as any;

    const latestTodoToolCall =
      findLatestTodoToolCallStateInCurrentTurn(history);

    expect(latestTodoToolCall?.toolCallId).toBe("todo-call-2");
  });
});
