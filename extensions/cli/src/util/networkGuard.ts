const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function isLocalhostHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(normalized)) {
    return true;
  }
  return normalized.endsWith(".localhost");
}

function isNetworkProtocol(protocol: string): boolean {
  return (
    protocol === "http:" ||
    protocol === "https:" ||
    protocol === "ws:" ||
    protocol === "wss:"
  );
}

export function assertLocalhostUrl(url: URL, context?: string): void {
  if (!isNetworkProtocol(url.protocol)) {
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
