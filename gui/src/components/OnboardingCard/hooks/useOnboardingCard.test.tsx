import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { renderWithProviders } from "../../../util/test/render";
import { useOnboardingCard } from "./useOnboardingCard";

/**
 * Minimal probe that surfaces the hook's state and actions to the DOM, so the
 * hook can be exercised through the same providers the real card renders in.
 */
function OnboardingCardProbe() {
  const { show, open, close } = useOnboardingCard();

  return (
    <div>
      <span data-testid="show">{String(show)}</span>
      <button data-testid="open" onClick={() => void open()}>
        open
      </button>
      <button data-testid="close" onClick={() => close()}>
        close
      </button>
    </div>
  );
}

describe("useOnboardingCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the card by default for a user who has not onboarded", async () => {
    await renderWithProviders(<OnboardingCardProbe />);

    expect(screen.getByTestId("show").textContent).toBe("true");
  });

  it("persists the dismissal when the card is closed", async () => {
    const { user } = await renderWithProviders(<OnboardingCardProbe />);

    await user.click(screen.getByTestId("close"));

    expect(screen.getByTestId("show").textContent).toBe("false");
    expect(getLocalStorage("hasDismissedOnboardingCard")).toBe(true);
  });

  // Regression test for https://github.com/continuedev/continue/issues/12582
  it("clears the persisted dismissal when the card is reopened", async () => {
    setLocalStorage("hasDismissedOnboardingCard", true);

    const { user } = await renderWithProviders(<OnboardingCardProbe />);
    expect(screen.getByTestId("show").textContent).toBe("false");

    await user.click(screen.getByTestId("open"));

    expect(screen.getByTestId("show").textContent).toBe("true");
    expect(getLocalStorage("hasDismissedOnboardingCard")).toBe(false);
  });

  // The redux `show` flag is not persisted by redux-persist, so reopening has
  // to clear the localStorage flag or the card vanishes again on next load.
  it("keeps the card visible after a reload once it has been reopened", async () => {
    setLocalStorage("hasDismissedOnboardingCard", true);

    const first = await renderWithProviders(<OnboardingCardProbe />);
    await first.user.click(screen.getByTestId("open"));
    first.unmount();

    // A fresh store stands in for a webview reload: only localStorage carries over.
    await renderWithProviders(<OnboardingCardProbe />);

    expect(screen.getByTestId("show").textContent).toBe("true");
  });
});
