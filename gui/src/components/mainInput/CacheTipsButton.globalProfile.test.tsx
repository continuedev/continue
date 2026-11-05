import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { cacheTips } from "../../util/cacheTips";
import { renderWithProviders } from "../../util/test/render";
import { CacheTipsButton } from "./CacheTipsButton";
import { act, screen } from "./noticeTestUtils";

const regional = {
  title: "Sonnet (Bedrock)",
  provider: "bedrock",
  model: "us.anthropic.claude-sonnet-4-6",
  underlyingProviderName: "bedrock",
};

describe("cacheTips: regional premium and the account's global profile", () => {
  const tip = (gp?: "present" | "absent" | "unknown") =>
    cacheTips(regional as any, "5m", undefined, undefined, gp).find(
      (t) => t.id === "regional-premium",
    )!;

  it("suggests the global ID when it is present, or not yet checked, or unknown", () => {
    for (const gp of [undefined, "present", "unknown"] as const) {
      const t = tip(gp);
      expect(t.severity).toBe("warning");
      expect(t.suggestion).toBe("global.anthropic.claude-sonnet-4-6");
    }
  });

  it("stops suggesting an ID the account does not list", () => {
    const t = tip("absent");
    expect(t.suggestion).toBeUndefined();
    expect(t.severity).toBe("info");
    expect(t.body).toContain("does not list a global profile");
    expect(t.body).not.toContain("try the global ID");
  });

  it("still reports the premium when there is no global profile", () => {
    expect(tip("absent").title).toBe("Regional endpoints cost 10% more");
  });
});

async function setup(model: any, reply?: unknown) {
  const ideMessenger = new MockIdeMessenger();
  const request = vi.spyOn(ideMessenger, "request");
  if (reply !== undefined) {
    (ideMessenger.responses as any)["bedrock/globalProfile"] = reply;
  }
  const store = setupStore({ ideMessenger });
  await renderWithProviders(<CacheTipsButton />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: model,
        },
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [model] },
      } as any),
    );
    store.dispatch(
      setPromptCacheSetting({ modelTitle: model.title, setting: "5m" }),
    );
  });
  return request;
}

const open = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId("cache-tips-button"));
  });
};

describe("CacheTipsButton asks core whether a global profile exists", () => {
  it("keeps the suggestion when the account lists the global profile", async () => {
    await setup(regional, "present");
    await open();
    expect(
      screen.getByTestId("cache-tip-regional-premium-suggestion"),
    ).toHaveTextContent("global.anthropic.claude-sonnet-4-6");
  });

  it("drops the suggestion when it does not", async () => {
    await setup(regional, "absent");
    await open();
    expect(
      screen.getByTestId("cache-tip-regional-premium"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("cache-tip-regional-premium-suggestion"),
    ).toBeNull();
  });

  it("falls back to suggesting it when core cannot tell", async () => {
    await setup(regional, "unknown");
    await open();
    expect(
      screen.getByTestId("cache-tip-regional-premium-suggestion"),
    ).toBeInTheDocument();
  });

  it("asks core once for a Bedrock model with a regional ID", async () => {
    const request = await setup(regional, "present");
    const asks = request.mock.calls.filter(
      ([type]) => type === "bedrock/globalProfile",
    );
    expect(asks).toEqual([
      ["bedrock/globalProfile", { title: regional.title }],
    ]);
  });

  it("does not ask for a global, non-Bedrock or non-regional model", async () => {
    for (const m of [
      { ...regional, model: "global.anthropic.claude-sonnet-4-6" },
      {
        ...regional,
        title: "Claude",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
      },
    ]) {
      const request = await setup(m);
      const asked = request.mock.calls.some(
        ([type]) => type === "bedrock/globalProfile",
      );
      expect(asked).toBe(false);
    }
  });
});
