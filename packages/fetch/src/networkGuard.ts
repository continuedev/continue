const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

type NodeUrl = import("url").URL;
type AnyUrl = URL | NodeUrl;

function isLocalhostHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(normalized)) {
    return true;
  }
  return normalized.endsWith(".localhost");
}

function shouldAllowProtocol(protocol: string): boolean {
  const normalized = protocol.toLowerCase();
  return (
    normalized === "http:" ||
    normalized === "https:" ||
    normalized === "ws:" ||
    normalized === "wss:"
  );
}

export function assertLocalhostUrl(url: AnyUrl, context?: string): void {
  if (!shouldAllowProtocol(url.protocol)) {
    return;
  }

  if (isLocalhostHostname(url.hostname)) {
    return;
  }

  const contextSuffix = context ? ` (${context})` : "";
  throw new Error(
    `Airgapped mode: external network calls are disabled${contextSuffix}. Host "${url.hostname}" is not allowed.`,
  );
}

export function assertLocalhostRequest(
  input: RequestInfo | URL | NodeUrl,
  context?: string,
): void {
  if (input instanceof URL) {
    assertLocalhostUrl(input, context);
    return;
  }

  if (typeof input === "string") {
    if (!input.includes("://")) {
      return;
    }
    assertLocalhostUrl(new URL(input), context);
    return;
  }

  const maybeUrl = (input as { url?: string }).url;
  if (typeof maybeUrl === "string") {
    if (!maybeUrl.includes("://")) {
      return;
    }
    assertLocalhostUrl(new URL(maybeUrl), context);
  }
}
