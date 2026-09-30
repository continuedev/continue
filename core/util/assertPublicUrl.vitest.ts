import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("is-localhost-ip", () => ({
  default: vi.fn(),
}));

import isLocalhost from "is-localhost-ip";
import { assertPublicHttpUrl } from "./assertPublicUrl";

afterEach(() => {
  vi.clearAllMocks();
});

describe("assertPublicHttpUrl", () => {
  test("allows http(s) hosts that are not private", async () => {
    (isLocalhost as any).mockResolvedValue(false);

    await expect(
      assertPublicHttpUrl(new URL("https://example.com/path")),
    ).resolves.toBeUndefined();
    await expect(
      assertPublicHttpUrl(new URL("http://example.com")),
    ).resolves.toBeUndefined();

    expect(isLocalhost).toHaveBeenCalledWith("example.com");
  });

  test("rejects private / local network hosts", async () => {
    (isLocalhost as any).mockResolvedValue(true);

    await expect(
      assertPublicHttpUrl(new URL("http://127.0.0.1/")),
    ).rejects.toThrow(/private or local network address/);
    await expect(
      assertPublicHttpUrl(new URL("http://192.168.1.10/secret")),
    ).rejects.toThrow(/private or local network address/);
    await expect(
      assertPublicHttpUrl(new URL("http://169.254.169.254/latest/meta-data")),
    ).rejects.toThrow(/private or local network address/);
  });

  test("rejects non-http(s) protocols without DNS lookup", async () => {
    await expect(
      assertPublicHttpUrl(new URL("file:///etc/passwd")),
    ).rejects.toThrow(/only http\/https/);
    expect(isLocalhost).not.toHaveBeenCalled();
  });

  test("fails closed when hostname verification throws", async () => {
    (isLocalhost as any).mockRejectedValue(new Error("DNS Lookup failed."));

    await expect(
      assertPublicHttpUrl(new URL("https://unresolvable.invalid")),
    ).rejects.toThrow(/could not verify hostname is public/);
  });
});
