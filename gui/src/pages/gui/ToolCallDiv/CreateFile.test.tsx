import { render, screen } from "@testing-library/react";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it, vi } from "vitest";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";

// StyledMarkdownPreview needs Redux; show the Markdown source it is given instead
vi.mock("../../../components/StyledMarkdownPreview", () => ({
  default: ({ source }: { source: string }) => (
    <pre data-testid="preview">{source}</pre>
  ),
}));

function createFileCall(contents: unknown): ToolCallState {
  const args = { filepath: "app/package.json", contents };
  return {
    toolCallId: "call-1",
    toolCall: {
      id: "call-1",
      type: "function",
      function: {
        name: BuiltInToolNames.CreateNewFile,
        arguments: JSON.stringify(args),
      },
    },
    status: "generated",
    // The arguments are parsed deeply, so the contents of a .json file arrive as an object
    parsedArgs: args,
  };
}

describe("CreateFile", () => {
  it("shows the contents of a JSON file instead of [object Object]", () => {
    render(
      <FunctionSpecificToolCallDiv
        toolCallState={createFileCall({ name: "app", version: "1.0.0" })}
        historyIndex={0}
      />,
    );
    const source = screen.getByTestId("preview").textContent ?? "";
    expect(source).not.toContain("[object Object]");
    expect(source).toContain('{\n  "name": "app",\n  "version": "1.0.0"\n}');
  });

  it("shows string contents unchanged", () => {
    render(
      <FunctionSpecificToolCallDiv
        toolCallState={createFileCall("export const x = 1;")}
        historyIndex={0}
      />,
    );
    expect(screen.getByTestId("preview").textContent).toContain(
      "export const x = 1;",
    );
  });
});
