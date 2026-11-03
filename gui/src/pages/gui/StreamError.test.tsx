import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
