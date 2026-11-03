import { describe, expect, it } from "vitest";

import { unresolvedSecretErrors } from "./unresolvedSecretErrors";

describe("unresolvedSecretErrors", () => {
  it("returns nothing when no credential refers to a missing secret", () => {
    expect(
      unresolvedSecretErrors([
        { name: "A", provider: "anthropic", apiKey: "sk-real" },
      ]),
    ).toEqual([]);
  });

  it("returns one non-fatal error per secret, with an action", () => {
    const errors = unresolvedSecretErrors([
      { name: "Sonnet", provider: "anthropic", apiKey: "${{ secrets.AK }}" },
      { name: "Opus", provider: "anthropic", apiKey: "${{ secrets.AK }}" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].fatal).toBe(false);
    expect(errors[0].message).toContain("AK");
    expect(errors[0].message).toContain('"Sonnet"');
    expect(errors[0].message).toContain('"Opus"');
    expect(errors[0].action).toEqual({
      kind: "setSecret",
      secretName: "AK",
      providers: ["anthropic"],
      modelNames: ["Sonnet", "Opus"],
    });
  });

  it("never puts a secret value in the message", () => {
    const [error] = unresolvedSecretErrors([
      { name: "A", provider: "openai", apiKey: "${{ secrets.OK }}" },
    ]);
    expect(error.message).not.toContain("sk-");
  });
});
