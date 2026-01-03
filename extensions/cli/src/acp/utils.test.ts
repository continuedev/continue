import { describe, expect, it } from "vitest";

import {
  buildToolTitle,
  convertPromptBlocks,
  getAcpToolKind,
  mapToolStatusToAcpStatus,
} from "./utils.js";

describe("ACP utils", () => {
  it("maps tool status to ACP status", () => {
    expect(mapToolStatusToAcpStatus("generated")).toBe("pending");
    expect(mapToolStatusToAcpStatus("calling")).toBe("in_progress");
    expect(mapToolStatusToAcpStatus("done")).toBe("completed");
    expect(mapToolStatusToAcpStatus("errored")).toBe("failed");
    expect(mapToolStatusToAcpStatus("canceled")).toBe("failed");
  });

  it("maps tool kinds for common tools", () => {
    expect(getAcpToolKind("Read")).toBe("read");
    expect(getAcpToolKind("Write")).toBe("edit");
    expect(getAcpToolKind("Search")).toBe("search");
    expect(getAcpToolKind("Bash")).toBe("execute");
    expect(getAcpToolKind("Fetch")).toBe("fetch");
    expect(getAcpToolKind("UnknownTool")).toBe("other");
  });

  it("builds a concise tool title", () => {
    expect(buildToolTitle("Read", { filepath: "/tmp/test.txt" })).toContain(
      "Read(",
    );
    expect(buildToolTitle("List")).toBe("List");
  });

  it("converts ACP prompt blocks into text and context items", () => {
    const result = convertPromptBlocks(
      [
        { type: "text", text: "Review this:" },
        {
          type: "resource",
          resource: {
            uri: "file:///tmp/sample.txt",
            text: "hello world",
          },
        },
        {
          type: "resource_link",
          name: "Spec",
          uri: "https://example.com/spec",
        },
      ],
      "/tmp",
    );

    expect(result.text).toContain("Review this:");
    expect(result.text).toContain("Resource Spec:");
    expect(result.contextItems.length).toBe(1);
    expect(result.contextItems[0]?.content).toBe("hello world");
  });
});
