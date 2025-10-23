import { describe, expect, it } from "vitest";
import { CreditStatus } from "../../control-plane/client";
import { isOutOfStarterCredits } from "./starterCredits";

describe("isOutOfStarterCredits", () => {
  it("should return true for free trial users who have run out of credits", () => {
    const creditStatus: CreditStatus = {
      optedInToFreeTrial: true,
      hasCredits: false,
      creditBalance: 0,
      hasPurchasedCredits: false,
    };

    expect(isOutOfStarterCredits(true, creditStatus)).toBe(true);
  });

  it("should return false for paid users who have run out of credits", () => {
    const creditStatus: CreditStatus = {
      optedInToFreeTrial: true,
      hasCredits: false,
      creditBalance: 0,
      hasPurchasedCredits: true,
    };

    expect(isOutOfStarterCredits(true, creditStatus)).toBe(false);
  });

  it("should return false for free trial users who still have credits", () => {
    const creditStatus: CreditStatus = {
      optedInToFreeTrial: true,
      hasCredits: true,
      creditBalance: 1000,
      hasPurchasedCredits: false,
    };

    expect(isOutOfStarterCredits(true, creditStatus)).toBe(false);
  });

  it("should return false for paid users who still have credits", () => {
    const creditStatus: CreditStatus = {
      optedInToFreeTrial: true,
      hasCredits: true,
      creditBalance: 5000,
      hasPurchasedCredits: true,
    };

    expect(isOutOfStarterCredits(true, creditStatus)).toBe(false);
  });

  it("should return false when not using credits-based API key", () => {
    const creditStatus: CreditStatus = {
      optedInToFreeTrial: true,
      hasCredits: false,
      creditBalance: 0,
      hasPurchasedCredits: false,
    };

    expect(isOutOfStarterCredits(false, creditStatus)).toBe(false);
  });

  it("should return false for users who did not opt into free trial", () => {
    const creditStatus: CreditStatus = {
      optedInToFreeTrial: false,
      hasCredits: false,
      creditBalance: 0,
      hasPurchasedCredits: false,
    };

    expect(isOutOfStarterCredits(true, creditStatus)).toBe(false);
  });

  it("should return false for paid users who never opted into free trial", () => {
    const creditStatus: CreditStatus = {
      optedInToFreeTrial: false,
      hasCredits: false,
      creditBalance: 0,
      hasPurchasedCredits: true,
    };

    expect(isOutOfStarterCredits(true, creditStatus)).toBe(false);
  });
});
