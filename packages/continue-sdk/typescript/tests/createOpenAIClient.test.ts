import { describe, expect, test } from "@jest/globals";
import { addContinuePropertiesToBody } from "../src/createOpenAIClient.js";

describe("addContinuePropertiesToBody", () => {
  test("adds Continue proxy properties for the requested assistant model", () => {
    const body = addContinuePropertiesToBody(
      JSON.stringify({
        model: "claude-3-7-sonnet-latest",
        messages: [{ role: "user", content: "Hello" }],
      }),
      [
        {
          model: "anthropic/claude-3-7-sonnet-latest",
          apiKeyLocation: "env:ANTHROPIC_API_KEY",
        },
      ] as any,
      "org_123",
    );

    expect(JSON.parse(body)).toEqual({
      model: "claude-3-7-sonnet-latest",
      messages: [{ role: "user", content: "Hello" }],
      continueProperties: {
        apiKeyLocation: "env:ANTHROPIC_API_KEY",
        orgScopeId: "org_123",
      },
    });
  });

  test("keeps non-JSON request bodies unchanged", () => {
    expect(
      addContinuePropertiesToBody("not-json", [] as any, "org_123"),
    ).toBe("not-json");
  });

  test("throws when the requested model is missing from the assistant", () => {
    expect(() =>
      addContinuePropertiesToBody(
        JSON.stringify({ model: "missing-model" }),
        [
          {
            model: "anthropic/claude-3-7-sonnet-latest",
            apiKeyLocation: "env:ANTHROPIC_API_KEY",
          },
        ] as any,
      ),
    ).toThrow("Model missing-model not found in assistant configuration");
  });

  test("throws when the requested model has no secret location", () => {
    expect(() =>
      addContinuePropertiesToBody(
        JSON.stringify({ model: "claude-3-7-sonnet-latest" }),
        [
          {
            model: "anthropic/claude-3-7-sonnet-latest",
          },
        ] as any,
      ),
    ).toThrow(
      "Model claude-3-7-sonnet-latest does not have an apiKeyLocation or envSecretLocations defined",
    );
  });
});
