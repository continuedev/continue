/**
 * Asks an MCP server what it needs for sign-in by sending one unauthenticated
 * request and reading the 401 `WWW-Authenticate` challenge.
 *
 * Servers such as Atlassian publish their OAuth metadata at a URL given only
 * in that header (`resource_metadata="..."`), so reading it makes sign-in work
 * where blind discovery at the server URL would not.
 */

const PROBE_TIMEOUT_MS = 5000;

/** Extracts `resource_metadata` from a `WWW-Authenticate: Bearer ...` header. */
export function parseResourceMetadataUrl(
  header: string | null | undefined,
): string | undefined {
  if (!header) return undefined;
  const match = header.match(/resource_metadata\s*=\s*"([^"]+)"/i);
  return match?.[1];
}

export interface ProbeResult {
  /** True when the server answered 401. */
  unauthorized: boolean;
  resourceMetadataUrl?: string;
}

type FetchLike = (url: string, init?: any) => Promise<Response>;

export async function probeAuthRequirement(
  serverUrl: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<ProbeResult> {
  try {
    const response = await fetchFn(serverUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "continue-client", version: "1.0.0" },
        },
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    // We only need the status and header; don't leave the body dangling.
    void response.body?.cancel().catch(() => {});
    return {
      unauthorized: response.status === 401,
      resourceMetadataUrl: parseResourceMetadataUrl(
        response.headers.get("www-authenticate"),
      ),
    };
  } catch {
    return { unauthorized: false };
  }
}

/** Convenience for sign-in: just the metadata URL, if the server advertises one. */
export async function probeResourceMetadataUrl(
  serverUrl: string,
  fetchFn?: FetchLike,
): Promise<URL | undefined> {
  const { resourceMetadataUrl } = await probeAuthRequirement(
    serverUrl,
    fetchFn,
  );
  if (!resourceMetadataUrl) return undefined;
  try {
    return new URL(resourceMetadataUrl);
  } catch {
    return undefined;
  }
}
