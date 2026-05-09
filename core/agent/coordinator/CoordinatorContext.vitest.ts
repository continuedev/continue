import { describe, expect, it } from "vitest";

import {
  buildCoordinatorWorkerSystemMessage,
  getCoordinatorScratchpadPath,
} from "./CoordinatorContext";

describe("CoordinatorContext", () => {
  it("builds the shared worker scratchpad path under the coordinator directory", () => {
    expect(getCoordinatorScratchpadPath("/tmp/yuto-home", "session-123")).toBe(
      "/tmp/yuto-home/coordinator/session-123/WORKER_SCRATCHPAD.md",
    );
  });

  it("includes truncation notice when scratchpad content exceeds the visible budget", () => {
    const message = buildCoordinatorWorkerSystemMessage({
      scratchpadPath:
        "/tmp/yuto-home/coordinator/session-123/WORKER_SCRATCHPAD.md",
      scratchpadContent: `${"A".repeat(4100)}tail-marker`,
    });

    expect(message).toContain("truncated to the most recent section");
    expect(message).toContain("tail-marker");
  });

  it("tells workers how to continue after a cancelled prior attempt", () => {
    const message = buildCoordinatorWorkerSystemMessage({
      scratchpadPath:
        "/tmp/yuto-home/coordinator/session-123/WORKER_SCRATCHPAD.md",
      scratchpadContent:
        "## prior\nStatus: cancelled\nSummary:\nResume from the last grep results.",
    });

    expect(message).toContain(
      "If the latest worker entry is marked `Status: cancelled`",
    );
    expect(message).toContain("Resume from the last grep results.");
  });
});
