import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { MissingSecretError } from "core/util/unresolvedSecrets";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import StreamErrorDialog from "./StreamError";

describe("stream error for a key that is not set on this machine", () => {
  it("names the secret and offers the fix, not a generic retry", async () => {
    const ideMessenger = new MockIdeMessenger();
    const store = setupStore({ ideMessenger });
    await renderWithProviders(
      <StreamErrorDialog error={new MissingSecretError("Claude", ["AK"])} />,
      { store, mockIdeMessenger: ideMessenger },
    );

    expect(screen.getByTestId("missing-secret-error")).toBeTruthy();
    expect(screen.getByTestId("open-env-AK")).toBeTruthy();
    expect(screen.queryByText("Resubmit last message")).toBeNull();
  });

  it("shows the normal dialog for any other error", async () => {
    const ideMessenger = new MockIdeMessenger();
    const store = setupStore({ ideMessenger });
    await renderWithProviders(
      <StreamErrorDialog error={new Error("something went wrong")} />,
      { store, mockIdeMessenger: ideMessenger },
    );
    expect(screen.queryByTestId("missing-secret-error")).toBeNull();
  });
});

describe("stream error for a failure that should pass", () => {
  async function render(error: Error) {
    const ideMessenger = new MockIdeMessenger();
    const store = setupStore({ ideMessenger });
    return renderWithProviders(<StreamErrorDialog error={error} />, {
      store,
      mockIdeMessenger: ideMessenger,
    });
  }

  it("says the message is kept and counts down to trying again, which can be cancelled", async () => {
    const { user } = await render(
      new Error(
        "The connection closed before the response arrived (tried 1 times). Check your network or proxy and resubmit. (Request timed out.)",
      ),
    );
    expect(screen.getByTestId("transient-failure").textContent).toContain(
      "Your message is kept",
    );
    expect(screen.getByTestId("retry-countdown").textContent).toContain(
      "Trying again in 15 s",
    );
    expect(screen.getByText("Try again now")).toBeTruthy();
    expect(screen.getByText("Change model")).toBeTruthy();
    await user.click(screen.getByText("Cancel"));
    expect(screen.getByTestId("retry-cancelled")).toBeTruthy();
  });

  it("does not wait on its own for an hour; it says how long the server asked for", async () => {
    await render(
      new Error(
        "The server asked to wait 3600 s before trying again (rate limit or overload), longer than Continue waits on its own.",
      ),
    );
    expect(screen.getByTestId("transient-failure").textContent).toContain(
      "asked to wait 1 h",
    );
    expect(screen.queryByTestId("retry-countdown")).toBeNull();
  });

  it("waits for the network when the computer is offline", async () => {
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      await render(new Error("fetch failed"));
      expect(screen.getByTestId("retry-countdown").textContent).toContain(
        "offline",
      );
    } finally {
      spy.mockRestore();
    }
  });
});
