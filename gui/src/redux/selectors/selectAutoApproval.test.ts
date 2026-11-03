import { describe, expect, it } from "vitest";
import {
  REVIEWER_NEEDED_MESSAGE,
  selectAutoApproval,
} from "./selectAutoApproval";

const state = (over: {
  flag?: boolean;
  reviewer?: boolean;
  mode?: "manual" | "auto";
}) =>
  ({
    config: {
      config: {
        experimental: { enableAutoApproval: over.flag },
        selectedModelByRole: {
          chat: { title: "chat" },
          reviewer: over.reviewer ? { title: "r" } : null,
        },
      },
    },
    ui: { approvalMode: over.mode ?? "manual" },
  }) as any;

describe("selectAutoApproval", () => {
  it("is not offered unless the experimental setting is on", () => {
    expect(
      selectAutoApproval(state({ reviewer: true, mode: "auto" })),
    ).toMatchObject({ offered: false, available: false, active: false });
  });

  it("is unavailable until a reviewer model is chosen, even in auto mode", () => {
    const s = selectAutoApproval(state({ flag: true, mode: "auto" }));
    expect(s).toMatchObject({ offered: true, available: false, active: false });
    expect(s.unavailableReason).toBe(REVIEWER_NEEDED_MESSAGE);
  });

  it("stays manual by default even when available", () => {
    expect(
      selectAutoApproval(state({ flag: true, reviewer: true })),
    ).toMatchObject({ available: true, active: false });
  });

  it("is active only when chosen, enabled and a reviewer is set", () => {
    expect(
      selectAutoApproval(state({ flag: true, reviewer: true, mode: "auto" }))
        .active,
    ).toBe(true);
  });
});
