import { screen } from "@testing-library/react";
import { Tool, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { renderWithProviders } from "../../../util/test/render";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";

describe("ToolCallStatusMessage", () => {
  it("renders a clickable file path for read/write actions and opens the file", async () => {
    const mockIdeMessenger = new MockIdeMessenger();
    const postSpy = vi.spyOn(mockIdeMessenger, "post");

    const tool: Tool = {
      type: "function",
      displayTitle: "Read File",
      wouldLikeTo: "read {{{ filepath }}}",
      isCurrently: "reading {{{ filepath }}}",
      hasAlready: "read {{{ filepath }}}",
      function: {
        name: BuiltInToolNames.ReadFile,
        description: "",
        parameters: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
            },
          },
        },
      },
    };

    const toolCallState: ToolCallState = {
      toolCallId: "read-tool-1",
      status: "done",
      toolCall: {
        id: "read-tool-1",
        type: "function",
        function: {
          name: BuiltInToolNames.ReadFile,
          arguments: JSON.stringify({ filepath: "/tmp/app.ts" }),
        },
      },
      parsedArgs: {
        filepath: "/tmp/app.ts",
      },
      output: [],
    };

    const { user } = await renderWithProviders(
      <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />,
      { mockIdeMessenger },
    );

    const filePathLink = screen.getByText("/tmp/app.ts");
    await user.click(filePathLink);

    expect(postSpy).toHaveBeenCalledWith("showFile", {
      filepath: "/tmp/app.ts",
    });
  });

  it("does not render a file path link for non read/write actions", async () => {
    const tool: Tool = {
      type: "function",
      displayTitle: "Run Terminal Command",
      wouldLikeTo: "run command",
      isCurrently: "running command",
      hasAlready: "ran command",
      function: {
        name: BuiltInToolNames.RunTerminalCommand,
        description: "",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
            },
          },
        },
      },
    };

    const toolCallState: ToolCallState = {
      toolCallId: "terminal-tool-1",
      status: "done",
      toolCall: {
        id: "terminal-tool-1",
        type: "function",
        function: {
          name: BuiltInToolNames.RunTerminalCommand,
          arguments: JSON.stringify({ command: "ls" }),
        },
      },
      parsedArgs: {
        command: "ls",
      },
      output: [],
    };

    await renderWithProviders(
      <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />,
    );

    expect(screen.queryByText("/tmp/app.ts")).not.toBeInTheDocument();
    expect(screen.getByTestId("tool-call-title").textContent).toContain(
      "Yuto ran command",
    );
  });

  it("highlights the action text while a tool call is in progress", async () => {
    const tool: Tool = {
      type: "function",
      displayTitle: "Run Terminal Command",
      wouldLikeTo: "run command",
      isCurrently: "running command",
      hasAlready: "ran command",
      function: {
        name: BuiltInToolNames.RunTerminalCommand,
        description: "",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
            },
          },
        },
      },
    };

    const toolCallState: ToolCallState = {
      toolCallId: "terminal-tool-calling",
      status: "calling",
      toolCall: {
        id: "terminal-tool-calling",
        type: "function",
        function: {
          name: BuiltInToolNames.RunTerminalCommand,
          arguments: JSON.stringify({ command: "npm test" }),
        },
      },
      parsedArgs: {
        command: "npm test",
      },
      output: [],
    };

    await renderWithProviders(
      <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />,
    );

    expect(screen.getByTestId("tool-call-action-text").className).toContain(
      "bg-[color:var(--vscode-input-background)]/60",
    );
  });

  it("shows a compact terminal result summary for completed commands", async () => {
    const tool: Tool = {
      type: "function",
      displayTitle: "Run Terminal Command",
      wouldLikeTo: "run command",
      isCurrently: "running command",
      hasAlready: "ran command",
      function: {
        name: BuiltInToolNames.RunTerminalCommand,
        description: "",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
            },
          },
        },
      },
    };

    const toolCallState: ToolCallState = {
      toolCallId: "terminal-tool-done",
      status: "done",
      toolCall: {
        id: "terminal-tool-done",
        type: "function",
        function: {
          name: BuiltInToolNames.RunTerminalCommand,
          arguments: JSON.stringify({ command: "npm test" }),
        },
      },
      parsedArgs: {
        command: "npm test",
      },
      output: [
        {
          id: {
            providerTitle: "toolCall",
            itemId: "terminal-output-1",
          },
          name: "Terminal",
          description: "terminal-output",
          content: "running tests\nall checks passed",
        },
      ],
    };

    await renderWithProviders(
      <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />,
    );

    expect(
      screen.getByTestId("tool-call-result-summary").textContent,
    ).toContain("Result: all checks passed");
  });
});
