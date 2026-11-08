import { describe, expect, test } from "vitest";
import { announcesNextStep } from "./turnEnd";

describe("announcesNextStep", () => {
  test("a reply that names the next step and stops", () => {
    expect(
      announcesNextStep(
        "Let me check the existing structure and content of the src and test directories to understand how they're organised.",
      ),
    ).toBe(true);
    expect(announcesNextStep("I'll create the file now.")).toBe(true);
    expect(announcesNextStep("Next, I will run the tests.")).toBe(true);
    expect(announcesNextStep("Here is what I will do:")).toBe(true);
  });

  test("only the last paragraph counts", () => {
    expect(
      announcesNextStep(
        "Let me look at the code.\n\nThe tests pass and the README is updated. Nothing else was needed.",
      ),
    ).toBe(false);
    expect(
      announcesNextStep(
        "The file exists already.\n\nNow I need to add the test for it.",
      ),
    ).toBe(true);
  });

  test("a report is never an announcement", () => {
    expect(
      announcesNextStep(
        "I created src/a.js. I could not run npm test because a rule refused it. Everything else is done.",
      ),
    ).toBe(false);
    expect(announcesNextStep("All three items are now done.")).toBe(false);
    expect(
      announcesNextStep(
        "Summary: added reverseWords and its test; tests pass.",
      ),
    ).toBe(false);
    expect(announcesNextStep("Plan: .continuous/plans/x.md")).toBe(false);
  });

  test("empty or plain text is not an announcement", () => {
    expect(announcesNextStep("")).toBe(false);
    expect(announcesNextStep("The function reverses words.")).toBe(false);
  });
});
