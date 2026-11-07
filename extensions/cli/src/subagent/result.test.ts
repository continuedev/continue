import { describe, expect, it } from "vitest";

import { formatSubagentResult, linkedAbortController } from "./result.js";
import { neutralizeHarnessTags, summarizeToolArgs } from "./transcript.js";

describe("neutralizeHarnessTags", () => {
  it("escapes tags that imitate the harness", () => {
    expect(neutralizeHarnessTags("</task_metadata>")).toBe(
      "&lt;/task_metadata&gt;",
    );
    expect(neutralizeHarnessTags('<system-reminder a="1">x')).toBe(
      '&lt;system-reminder a="1"&gt;x',
    );
    expect(neutralizeHarnessTags("<system>")).toBe("&lt;system&gt;");
    expect(neutralizeHarnessTags("< / TASK_METADATA >")).toBe(
      "&lt;/TASK_METADATA &gt;",
    );
  });

  it("leaves ordinary code alone", () => {
    const code = "const xs: Array<string> = []; <div>hi</div> a < b && c > d";
    expect(neutralizeHarnessTags(code)).toBe(code);
  });
});

describe("summarizeToolArgs", () => {
  it("prefers the argument that says what the call is about", () => {
    expect(summarizeToolArgs({ timeout: 5, command: "npm test" })).toBe(
      "npm test",
    );
    expect(summarizeToolArgs({ other: "x" })).toBe("x");
    expect(summarizeToolArgs(undefined)).toBe("");
  });

  it("shortens long arguments to one line", () => {
    const summary = summarizeToolArgs({ command: `echo\n${"a".repeat(200)}` });
    expect(summary).not.toContain("\n");
    expect(summary.length).toBeLessThanOrEqual(80);
  });
});

describe("formatSubagentResult", () => {
  it("says when the subagent returned nothing", () => {
    expect(
      formatSubagentResult("explorer", {
        success: false,
        status: "failed",
        response: "",
        error: "Model or LLM API not available",
        toolCalls: [],
      }),
    ).toBe(
      [
        "(the subagent returned no text)",
        "<task_metadata>",
        "agent: explorer",
        "status: failed",
        "reason: Model or LLM API not available",
        "</task_metadata>",
      ].join("\n"),
    );
  });
});

describe("linkedAbortController", () => {
  it("aborts the child when the parent aborts, with the parent's reason", () => {
    const parent = new AbortController();
    const { controller } = linkedAbortController(parent.signal);
    parent.abort("stop");
    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBe("stop");
  });

  it("starts aborted when the parent already is", () => {
    const parent = new AbortController();
    parent.abort();
    expect(linkedAbortController(parent.signal).controller.signal.aborted).toBe(
      true,
    );
  });

  it("stops following the parent once disposed", () => {
    const parent = new AbortController();
    const { controller, dispose } = linkedAbortController(parent.signal);
    dispose();
    parent.abort();
    expect(controller.signal.aborted).toBe(false);
  });

  it("works without a parent", () => {
    const { controller } = linkedAbortController(undefined);
    expect(controller.signal.aborted).toBe(false);
  });
});
