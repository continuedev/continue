import { describe, expect, it } from "vitest";
import {
  REVIEWER_NEEDED_MESSAGE,
  selectApprovalSettings,
  selectAutoApproval,
  selectEffectiveApprovalMode,
} from "./selectAutoApproval";

const state = (over: {
  flag?: boolean;
  reviewer?: boolean;
  mode?: "manual" | "autoApprove" | "auto" | "yolo";
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
    ui: {
      approvalMode: over.mode ?? "manual",
      approvalCategories: { readFiles: true },
      approvalMcpServers: { s1: true },
    },
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

describe("selectApprovalSettings", () => {
  it("sends nothing in Manual, so core behaves as before", () => {
    expect(selectApprovalSettings(state({}))).toBeUndefined();
  });

  it("sends the mode, switches and per-server switches otherwise", () => {
    expect(selectApprovalSettings(state({ mode: "autoApprove" }))).toEqual({
      mode: "autoApprove",
      categories: { readFiles: true },
      mcpServers: { s1: true },
    });
    expect(selectApprovalSettings(state({ mode: "yolo" }))?.mode).toBe("yolo");
  });

  it("a saved Auto that cannot run becomes Manual, never the looser switches", () => {
    const noReviewer = state({ flag: true, mode: "auto" });
    expect(selectEffectiveApprovalMode(noReviewer)).toBe("manual");
    expect(selectApprovalSettings(noReviewer)).toBeUndefined();
    const experimentOff = state({ reviewer: true, mode: "auto" });
    expect(selectApprovalSettings(experimentOff)).toBeUndefined();
  });

  it("Auto is sent as auto once usable", () => {
    expect(
      selectApprovalSettings(
        state({ flag: true, reviewer: true, mode: "auto" }),
      )?.mode,
    ).toBe("auto");
  });
});
