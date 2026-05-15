import { screen } from "@testing-library/react";
import { ApplyState } from "core";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../util/test/render";
import { ModifiedFilesMenu } from "./ModifiedFilesMenu";

function createApplyStates(): ApplyState[] {
  return [
    {
      streamId: "stream-1",
      status: "done",
      filepath: "file:///workspace/src/app/alpha.ts",
      toolCallId: "tool-call-1",
      originalFileContent: "const a = 1;\n",
      fileContent: "const a = 1;\nconst b = 2;\n",
    },
    {
      streamId: "stream-2",
      status: "done",
      filepath: "file:///workspace/src/core/beta.ts",
      toolCallId: "tool-call-2",
      originalFileContent: "line a\nline b\n",
      fileContent: "line a\n",
    },
  ];
}

describe("ModifiedFilesMenu", () => {
  it("shows changed file summary with +/- counts", async () => {
    await renderWithProviders(
      <ModifiedFilesMenu applyStates={createApplyStates()} />,
    );

    const header = screen.getByTestId("modified-files-menu-header");
    expect(header).toHaveTextContent("2 files changed");
    expect(header).toHaveTextContent("+1");
    expect(header).toHaveTextContent("-1");

    expect(screen.getByText("alpha.ts")).toBeInTheDocument();
    expect(screen.getByText("beta.ts")).toBeInTheDocument();
  });

  it("collapses and expands the changed files list", async () => {
    const { user } = await renderWithProviders(
      <ModifiedFilesMenu applyStates={createApplyStates()} />,
    );

    const header = screen.getByTestId("modified-files-menu-header");
    const body = screen.getByTestId("modified-files-menu-body");

    expect(header).toHaveAttribute("aria-expanded", "true");

    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(body.className).toContain("max-h-0");

    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(body.className).toContain("max-h-[40vh]");
  });
});
