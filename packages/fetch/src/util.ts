/**
 * Gets the proxy settings from environment variables
 * @param protocol The URL protocol (http: or https:)
 * @returns The proxy URL if available, otherwise undefined
 */
export function getProxyFromEnv(protocol: string): string | undefined {
  if (protocol === "https:") {
    return (
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy
    );
  } else {
    return process.env.HTTP_PROXY || process.env.http_proxy;
  }
}

/**
 * Checks if a hostname should bypass proxy based on NO_PROXY environment variable
 * @param hostname The hostname to check
 * @returns True if the hostname should bypass proxy
 */
export function shouldBypassProxy(hostname: string): boolean {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (!noProxy) return false;

  const noProxyItems = noProxy.split(",").map((item) => item.trim());

  return noProxyItems.some((item) => {
    // Exact match
    if (item === hostname) return true;

    // Wildcard domain match (*.example.com)
    if (item.startsWith("*.") && hostname.endsWith(item.substring(1)))
      return true;

    // Domain suffix match (.example.com)
    if (item.startsWith(".") && hostname.endsWith(item.slice(1))) return true;

    return false;
  });
}
