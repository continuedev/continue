import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { DecisionChip } from "../../pages/gui/ToolCallDiv/DecisionChip";
import {
  addBlockedCall,
  allowBlockedOnce,
  blockedCallsSlice,
  grantKey,
  initialBlockedCalls,
} from "../../redux/slices/blockedCallsSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { RecentlyBlocked } from "./RecentlyBlocked";

const item = (id: string, source: string) => ({
  id,
  toolName: "run_terminal_command",
  summary: `cmd ${id}`,
  source,
  reason: "why",
  parsedArgs: { command: `cmd ${id}` },
  at: 1,
});

describe("blockedCallsSlice", () => {
  const reduce = blockedCallsSlice.reducer;

  it("allow once makes a grant for an Auto refusal only", () => {
    let s = reduce(initialBlockedCalls, addBlockedCall(item("a", "auto")));
    s = reduce(s, addBlockedCall(item("b", "deny-rule")));
    s = reduce(s, addBlockedCall(item("c", "safety-floor")));
    s = reduce(s, addBlockedCall(item("d", "protected-path")));
    for (const id of ["a", "b", "c", "d"]) s = reduce(s, allowBlockedOnce(id));
    expect(s.grants).toEqual([
      grantKey("run_terminal_command", { command: "cmd a" }),
    ]);
    expect(s.items.find((i) => i.id === "b")?.allowedOnce).toBeUndefined();
  });

  it("allowing twice does not add a second grant", () => {
    let s = reduce(initialBlockedCalls, addBlockedCall(item("a", "auto")));
    s = reduce(s, allowBlockedOnce("a"));
    s = reduce(s, allowBlockedOnce("a"));
    expect(s.grants).toHaveLength(1);
  });

  it("keeps the newest first and at most 50", () => {
    let s = initialBlockedCalls;
    for (let i = 0; i < 60; i++) {
      s = reduce(s, addBlockedCall(item(String(i), "auto")));
    }
    expect(s.items).toHaveLength(50);
    expect(s.items[0].id).toBe("59");
  });

  it("is not part of the persisted state", async () => {
    const store = setupStore({ ideMessenger: new MockIdeMessenger() });
    expect(store.getState().blockedCalls).toEqual(initialBlockedCalls);
  });
});

describe("RecentlyBlocked", () => {
  async function setup() {
    const ideMessenger = new MockIdeMessenger();
    const store = setupStore({ ideMessenger });
    const view = await renderWithProviders(<RecentlyBlocked />, {
      store,
      mockIdeMessenger: ideMessenger,
    });
    return { ...view, store };
  }

  it("shows nothing when nothing was blocked", async () => {
    await setup();
    expect(screen.queryByTestId("recently-blocked")).toBeNull();
  });

  it("lists refusals and offers allow once only for Auto's", async () => {
    const { store, user } = await setup();
    await act(async () => {
      store.dispatch(addBlockedCall(item("a", "auto")));
      store.dispatch(addBlockedCall(item("b", "deny-rule")));
    });
    await user.click(screen.getByTestId("recently-blocked-toggle"));
    expect(screen.getByTestId("allow-once-a")).toBeDefined();
    expect(screen.queryByTestId("allow-once-b")).toBeNull();
    expect(screen.getByTestId("blocked-b").textContent).toContain(
      "Set by your rules",
    );
    await user.click(screen.getByTestId("allow-once-a"));
    expect(store.getState().blockedCalls.grants).toHaveLength(1);
    expect(screen.getByTestId("blocked-a").textContent).toContain(
      "Allowed once",
    );
  });
});

describe("DecisionChip", () => {
  it("renders nothing without a decision", () => {
    const { container } = render(<DecisionChip decision={undefined} />);
    expect(container.textContent).toBe("");
  });

  it("names who allowed and why", async () => {
    render(
      <DecisionChip
        decision={{
          outcome: "allowed",
          source: "allow-rule",
          reason: "Allowed by your rule npm test.",
          rule: "runTerminalCommand(npm test)",
        }}
      />,
    );
    const chip = screen.getByTestId("decision-chip");
    expect(chip.textContent).toBe("Allowed by rule");
    expect(chip.getAttribute("title")).toContain(
      "runTerminalCommand(npm test)",
    );
    void userEvent;
  });

  it("names a reviewer refusal with its category", () => {
    render(
      <DecisionChip
        decision={{
          outcome: "blocked",
          source: "auto",
          category: "production-impact",
          reason: "Targets prod.",
        }}
      />,
    );
    const chip = screen.getByTestId("decision-chip");
    expect(chip.textContent).toBe("Blocked by Auto [production-impact]");
    expect(chip.getAttribute("data-outcome")).toBe("blocked");
  });
});
