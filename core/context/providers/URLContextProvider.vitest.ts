import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../util/assertPublicUrl", () => ({
  assertPublicHttpUrl: vi.fn(),
}));

vi.mock("../../util/fetchFavicon", () => ({
  fetchFavicon: vi.fn().mockResolvedValue(undefined),
}));

import { assertPublicHttpUrl } from "../../util/assertPublicUrl";
import { fetchFavicon } from "../../util/fetchFavicon";
import { getUrlContextItems } from "./URLContextProvider";

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUrlContextItems SSRF guard", () => {
  test("does not fetch when assertPublicHttpUrl rejects", async () => {
    (assertPublicHttpUrl as any).mockRejectedValue(
      new Error(
        "Blocked URL fetch to private or local network address: 127.0.0.1",
      ),
    );
    const fetchFn = vi.fn();

    await expect(
      getUrlContextItems("http://127.0.0.1/", fetchFn as any),
    ).rejects.toThrow(/private or local network address/);

    expect(assertPublicHttpUrl).toHaveBeenCalled();
    expect(fetchFavicon).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("fetches after public URL check passes", async () => {
    (assertPublicHttpUrl as any).mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        "<html><body><article><h1>Hi</h1><p>Hello</p></article></body></html>",
    });

    const items = await getUrlContextItems(
      "https://example.com/",
      fetchFn as any,
    );
    expect(assertPublicHttpUrl).toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalled();
    expect(items).toHaveLength(1);
  });
});
