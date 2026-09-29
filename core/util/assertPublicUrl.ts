import isLocalhost from "is-localhost-ip";

/**
 * Reject http(s) URLs whose host resolves to a private / local / link-local
 * address before the host-side fetch runs (SSRF egress control for agent URL tools).
 *
 * Uses the same `is-localhost-ip` helper already depended on by HttpContextProvider.
 */
export async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `Blocked URL fetch: only http/https are allowed (got ${url.protocol})`,
    );
  }

  const hostname = url.hostname;
  if (!hostname) {
    throw new Error("Blocked URL fetch: missing hostname");
  }

  let isPrivate: boolean;
  try {
    isPrivate = await isLocalhost(hostname);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Blocked URL fetch: could not verify hostname is public (${hostname}): ${message}`,
    );
  }

  if (isPrivate) {
    throw new Error(
      `Blocked URL fetch to private or local network address: ${hostname}`,
    );
  }
}
