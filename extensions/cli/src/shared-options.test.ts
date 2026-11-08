import { Command } from "commander";
import { describe, expect, it } from "vitest";

import { mergeParentOptions } from "./shared-options.js";

describe("mergeParentOptions", () => {
  it("passes --beta-subagent-tool down to a subcommand such as serve", () => {
    const parent = new Command().option(
      "--beta-subagent-tool",
      "Enable the Subagent tool",
    );
    parent.parse(["--beta-subagent-tool"], { from: "user" });

    expect(mergeParentOptions(parent, {}).betaSubagentTool).toBe(true);
  });
});
