import { setLocalStorage } from "./localStorage";

describe("localStorage Test", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should stringify and set value in localStorage", () => {
    const MOCK_ONBOARDING_STATUS_VALUE = "Started";
    setLocalStorage("onboardingStatus", MOCK_ONBOARDING_STATUS_VALUE);
    expect(JSON.parse(localStorage.getItem("onboardingStatus") || "")).toEqual(
      MOCK_ONBOARDING_STATUS_VALUE,
    );
  });
});
