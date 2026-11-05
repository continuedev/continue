import { describe, expect, it, vi } from "vitest";

vi.mock("../../util/networkAddress", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../util/networkAddress")>();
  // Resolve by name in the test: "public.test" is public, "inside.test" is not.
  return {
    ...real,
    resolvesToNonPublic: async (host: string) =>
      host === "inside.test" || real.isNonPublicHostname(host),
  };
});

import { fetchUrlContentTool } from "../definitions/fetchUrlContent";
import { fetchUrlContentImpl } from "./fetchUrlContent";

const page = (body = "<html><body><p>hello</p></body></html>") =>
  new Response(body, { status: 200, headers: { "content-type": "text/html" } });
const redirect = (to: string) =>
  new Response(null, { status: 302, headers: { location: to } });

const run = (url: string, fetch: any) =>
  fetchUrlContentImpl({ url }, { fetch } as any);

describe("fetch_url redirect guard", () => {
  it("refuses a redirect from a public host to a non-public one", async () => {
    const fetch = vi.fn(async (u: URL) =>
      u.hostname === "public.test"
        ? redirect("http://169.254.169.254/latest")
        : page(),
    );
    await expect(run("http://public.test/", fetch)).rejects.toThrow(
      /non-public/,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to a public-looking name that resolves inside", async () => {
    const fetch = vi.fn(async (u: URL) =>
      u.hostname === "public.test" ? redirect("http://inside.test/") : page(),
    );
    await expect(run("http://public.test/", fetch)).rejects.toThrow(
      /non-public/,
    );
  });

  it("follows redirects between public hosts", async () => {
    const fetch = vi.fn(async (u: URL) =>
      u.pathname === "/old" ? redirect("/new") : page(),
    );
    const items = await run("http://public.test/old", fetch);
    expect(items[0].content).toContain("hello");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("follows redirects within an approved non-public URL", async () => {
    const fetch = vi.fn(async (u: URL) =>
      u.pathname === "/" ? redirect("http://127.0.0.1:3000/docs") : page(),
    );
    const items = await run("http://localhost:3000/", fetch);
    expect(items[0].content).toContain("hello");
  });
});

describe("fetch_url policy", () => {
  const policy = (url: string, base = "allowedWithoutPermission" as const) =>
    fetchUrlContentTool.evaluateToolCallPolicy!(base, { url });

  it("asks for non-public URLs even when auto-approved", () => {
    expect(policy("http://localhost:8080/")).toBe("allowedWithPermission");
    expect(policy("http://169.254.169.254/")).toBe("allowedWithPermission");
    expect(policy("http://10.0.0.1/")).toBe("allowedWithPermission");
  });

  it("keeps the user's policy for public URLs, and disabled stays disabled", () => {
    expect(policy("https://example.com/")).toBe("allowedWithoutPermission");
    expect(
      fetchUrlContentTool.evaluateToolCallPolicy!("disabled", {
        url: "http://localhost/",
      }),
    ).toBe("disabled");
  });
});
