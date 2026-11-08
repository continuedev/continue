import { describe, expect, test } from "vitest";
import { LOCAL_MAX_OUTPUT_TOKENS, localOutputLimit } from "./outputLimit.js";

const LOCAL = "http://127.0.0.1:8080/v1";

describe("localOutputLimit", () => {
  test("a local model with no configured limit gets the room that is left", () => {
    expect(
      localOutputLimit({ apiBase: LOCAL, outputTokensAvailable: 50_000 }),
    ).toBe(50_000);
  });

  test("the 4096 default counts as not configured", () => {
    expect(
      localOutputLimit({
        apiBase: LOCAL,
        maxTokens: 4096,
        outputTokensAvailable: 50_000,
      }),
    ).toBe(50_000);
  });

  test("the ceiling still ends a runaway reply", () => {
    expect(
      localOutputLimit({ apiBase: LOCAL, outputTokensAvailable: 400_000 }),
    ).toBe(LOCAL_MAX_OUTPUT_TOKENS);
  });

  test("a nearly full context does not go below the default", () => {
    expect(
      localOutputLimit({ apiBase: LOCAL, outputTokensAvailable: 900 }),
    ).toBe(4096);
  });

  test("a limit the person configured stands", () => {
    expect(
      localOutputLimit({
        apiBase: LOCAL,
        maxTokens: 32_768,
        outputTokensAvailable: 400_000,
      }),
    ).toBeUndefined();
  });

  test("hosted providers keep their default", () => {
    expect(
      localOutputLimit({
        apiBase: "https://api.example.com/v1",
        outputTokensAvailable: 400_000,
      }),
    ).toBeUndefined();
    expect(
      localOutputLimit({ outputTokensAvailable: 400_000 }),
    ).toBeUndefined();
  });
});
