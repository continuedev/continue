import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../../../context/MockIdeMessenger";
import {
  EMPTY_CONFIG,
  updateConfig,
} from "../../../../redux/slices/configSlice";
import { newSession } from "../../../../redux/slices/sessionSlice";
import { setupStore } from "../../../../redux/store";
import { renderWithProviders } from "../../../../util/test/render";
import { PendingToolCallToolbar } from "./PendingToolCallToolbar";

const call = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    toolCallId: id,
    toolCall: {
      id,
      type: "function",
      function: { name: "read_file", arguments: "{}" },
    },
    parsedArgs: { filepath: ".env" },
    status: "generated",
    ...extra,
  }) as any;

async function setup(calls: any[]) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<PendingToolCallToolbar />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(updateConfig({ ...EMPTY_CONFIG }));
    store.dispatch(
      newSession({
        sessionId: "s",
        title: "t",
        workspaceDirectory: "",
        history: [
          {
            message: { role: "assistant", content: "" },
            contextItems: [],
            toolCallStates: calls,
          },
        ],
      } as any),
    );
  });
  return view;
}

describe("PendingToolCallToolbar: why it is asking", () => {
  it("shows the reason a protected path or ask rule made the call wait", async () => {
    await setup([
      call("a", {
        policyNote:
          "This touches .env, which can hold credentials, so it always asks first.",
      }),
    ]);
    expect(screen.getByTestId("policy-note-a").textContent).toContain(".env");
  });

  it("shows nothing when there is no note", async () => {
    await setup([call("a")]);
    expect(screen.queryByTestId("policy-note-a")).toBeNull();
  });

  it("shows each call's own note", async () => {
    await setup([
      call("a", { policyNote: "note for a" }),
      call("b"),
      call("c", { policyNote: "note for c" }),
    ]);
    expect(screen.getByTestId("policy-note-a").textContent).toBe("note for a");
    expect(screen.queryByTestId("policy-note-b")).toBeNull();
    expect(screen.getByTestId("policy-note-c").textContent).toBe("note for c");
  });

  it("keeps the whole reason available on hover for a long note", async () => {
    const long = "This touches a very long path ".repeat(8);
    await setup([call("a", { policyNote: long })]);
    expect(screen.getByTestId("policy-note-a").getAttribute("title")).toBe(
      long,
    );
  });
});
