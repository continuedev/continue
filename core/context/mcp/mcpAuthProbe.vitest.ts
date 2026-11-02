import { SseError } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { describe, expect, test } from "vitest";
import { isUnauthorizedError } from "./MCPConnection";
import { parseResourceMetadataUrl, probeAuthRequirement } from "./mcpAuthProbe";

describe("isUnauthorizedError", () => {
  test("recognises 401 by status code, whatever the body says", () => {
    expect(
      isUnauthorizedError(new StreamableHTTPError(401, "invalid_token")),
    ).toBe(true);
    expect(
      isUnauthorizedError(
        new StreamableHTTPError(401, "Invalid or expired token"),
      ),
    ).toBe(true);
    expect(isUnauthorizedError(new SseError(401, "nope", {} as any))).toBe(
      true,
    );
    expect(isUnauthorizedError(new UnauthorizedError())).toBe(true);
    expect(
      isUnauthorizedError(Object.assign(new Error("x"), { status: 401 })),
    ).toBe(true);
  });

  test("looks through wrapped causes", () => {
    const wrapped = new Error("Connection failed", {
      cause: new StreamableHTTPError(401, "denied"),
    });
    expect(isUnauthorizedError(wrapped)).toBe(true);
  });

  test("keeps the message fallback for transports without a status", () => {
    expect(isUnauthorizedError(new Error("HTTP 401"))).toBe(true);
    expect(isUnauthorizedError(new Error("Unauthorized"))).toBe(true);
  });

  test("does not flag other failures", () => {
    expect(isUnauthorizedError(new StreamableHTTPError(500, "boom"))).toBe(
      false,
    );
    expect(isUnauthorizedError(new StreamableHTTPError(403, "forbidden"))).toBe(
      false,
    );
    expect(isUnauthorizedError(new Error("ECONNREFUSED"))).toBe(false);
    expect(isUnauthorizedError(undefined)).toBe(false);
  });
});

describe("WWW-Authenticate parsing", () => {
  test("extracts resource_metadata", () => {
    expect(
      parseResourceMetadataUrl(
        'Bearer realm="mcp", resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
      ),
    ).toBe("https://mcp.example.com/.well-known/oauth-protected-resource");
  });

  test("returns undefined without it", () => {
    expect(parseResourceMetadataUrl('Bearer realm="mcp"')).toBeUndefined();
    expect(parseResourceMetadataUrl(null)).toBeUndefined();
  });
});

describe("probeAuthRequirement", () => {
  const fakeFetch = (status: number, header?: string) =>
    (async () =>
      ({
        status,
        headers: { get: () => header ?? null },
        body: { cancel: async () => {} },
      }) as any) as any;

  test("reports a 401 and its metadata URL", async () => {
    const result = await probeAuthRequirement(
      "https://x/mcp",
      fakeFetch(401, 'Bearer resource_metadata="https://x/meta"'),
    );
    expect(result).toEqual({
      unauthorized: true,
      resourceMetadataUrl: "https://x/meta",
    });
  });

  test("a 200 is not 'unauthorized'", async () => {
    expect(
      (await probeAuthRequirement("https://x/mcp", fakeFetch(200)))
        .unauthorized,
    ).toBe(false);
  });

  test("network failures are swallowed", async () => {
    const failing = (async () => {
      throw new Error("ENOTFOUND");
    }) as any;
    expect(await probeAuthRequirement("https://x/mcp", failing)).toEqual({
      unauthorized: false,
    });
  });
});
