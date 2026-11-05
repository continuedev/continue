import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  recordCacheRequest,
  recordRequestFailure,
} from "../../redux/slices/sessionSlice";
import { setupStore } from "../../redux/store";
import { entry } from "../../util/cacheLedger.testUtils";
import { renderWithProviders } from "../../util/test/render";
import { PromptCacheButton } from "./PromptCacheButton";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};

async function setup() {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<PromptCacheButton />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: claude,
        },
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [claude] },
      } as any),
    );
  });
  return { ...view, store };
}

describe("PromptCacheButton: copy cache record", () => {
  afterEach(() => vi.restoreAllMocks());

  it("has no such entry before any request was recorded", async () => {
    const { user } = await setup();
    await user.click(screen.getByTestId("prompt-cache-button"));
    expect(screen.queryByTestId("prompt-cache-option-copy-record")).toBeNull();
  });

  it("copies the ledger and the failures as JSON, without message text", async () => {
    const { user, store } = await setup();
    // user-event installs its own clipboard on navigator; spy on that one
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    await act(async () => {
      store.dispatch(
        recordCacheRequest(
          entry({ requestId: "req-9", stopReason: "end_turn", read: 500 }),
        ),
      );
      store.dispatch(
        recordRequestFailure({
          at: 1,
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          kind: "throttled",
        }),
      );
    });
    await user.click(screen.getByTestId("prompt-cache-button"));
    await user.click(screen.getByTestId("prompt-cache-option-copy-record"));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = JSON.parse((writeText.mock.calls[0] as any)[0]);
    expect(copied.requests).toHaveLength(1);
    expect(copied.requests[0].requestId).toBe("req-9");
    expect(copied.failureCounts.throttled).toBe(1);
    expect(copied.promptShape.prompts).toBe(1);
  });

  it("does not change the cache setting", async () => {
    const { user, store } = await setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await act(async () => {
      store.dispatch(recordCacheRequest(entry()));
    });
    await user.click(screen.getByTestId("prompt-cache-button"));
    await user.click(screen.getByTestId("prompt-cache-option-copy-record"));
    expect(
      store.getState().ui.promptCacheSettings?.["Claude Sonnet"],
    ).toBeUndefined();
  });
});
