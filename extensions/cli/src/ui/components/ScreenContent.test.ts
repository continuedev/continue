import { describe, expect, it } from "vitest";

import { UpdateStatus, type UpdateServiceState } from "../../services/types.js";

import { hideScreenContent } from "./ScreenContent.js";

const state = (over: Partial<UpdateServiceState>): UpdateServiceState => ({
  autoUpdate: true,
  isAutoUpdate: true,
  status: UpdateStatus.IDLE,
  message: "",
  error: null,
  isUpdateAvailable: false,
  latestVersion: null,
  currentVersion: "2.4.5",
  ...over,
});

describe("hideScreenContent", () => {
  // With the input unmounted nothing listens on stdin and Node exits.
  it("keeps the input up while checking for updates", () => {
    expect(hideScreenContent(state({ status: UpdateStatus.CHECKING }))).toBe(
      false,
    );
  });

  it("hides it while an automatic update replaces the process", () => {
    expect(hideScreenContent(state({ status: UpdateStatus.UPDATING }))).toBe(
      true,
    );
  });
});
