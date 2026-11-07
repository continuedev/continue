import { describe, expect, it } from "vitest";
import { formatWait, transientFailure } from "./transientFailure";

describe("transientFailure", () => {
  it("knows a rate limit, an overload and a lost connection", () => {
    expect(transientFailure(429, "Too Many Requests")?.kind).toBe("rate-limit");
    expect(transientFailure(503, "Service Unavailable")?.kind).toBe(
      "overloaded",
    );
    expect(
      transientFailure(
        undefined,
        "The connection closed before the response arrived (tried 1 times). (Request timed out.)",
      )?.kind,
    ).toBe("connection");
  });

  it("uses the wait the server asked for", () => {
    const f = transientFailure(
      undefined,
      "The server asked to wait 3600 s before trying again (rate limit or overload)",
    );
    expect(f).toMatchObject({ waitSeconds: 3600, waitFromServer: true });
  });

  it("leaves other errors to the usual dialog", () => {
    expect(transientFailure(400, "invalid tool schema")).toBeUndefined();
    expect(transientFailure(401, "bad key")).toBeUndefined();
  });

  it("formats waits", () => {
    expect(formatWait(45)).toBe("45 s");
    expect(formatWait(180)).toBe("3 min");
    expect(formatWait(3900)).toBe("1 h 5 min");
  });
});
