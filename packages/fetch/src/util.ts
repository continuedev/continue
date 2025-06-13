import { RequestOptions } from "@continuedev/config-types";

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

// Note that request options proxy (per model) takes precedence over environment variables
export function getProxy(
  protocol: string,
  requestOptions?: RequestOptions,
): string | undefined {
  if (requestOptions?.proxy) {
    return requestOptions.proxy;
  }
  return getProxyFromEnv(protocol);
}

export function getEnvNoProxyPatterns(): string[] {
  const envValue = process.env.NO_PROXY || process.env.no_proxy;
  if (envValue) {
    return envValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((i) => !!i);
  } else {
    return [];
  }
}

export function getReqOptionsNoProxyPatterns(
  options: RequestOptions | undefined,
): string[] {
  return (
    options?.noProxy?.map((i) => i.trim().toLowerCase()).filter((i) => !!i) ??
    []
  );
}

export function patternMatchesHostname(hostname: string, pattern: string) {
  // Split hostname and pattern to separate hostname and port
  const [hostnameWithoutPort, hostnamePort] = hostname.toLowerCase().split(":");
  const [patternWithoutPort, patternPort] = pattern.toLowerCase().split(":");

  // If pattern specifies a port but hostname doesn't match it, no match
  if (patternPort && (!hostnamePort || hostnamePort !== patternPort)) {
    return false;
  }

  // Now compare just the hostname parts

  // exact match
  if (patternWithoutPort === hostnameWithoutPort) {
    return true;
  }
  // wildcard domain match (*.example.com)
  if (
    patternWithoutPort.startsWith("*.") &&
    hostnameWithoutPort.endsWith(patternWithoutPort.substring(1))
  ) {
    return true;
  }
  // Domain suffix match (.example.com)
  if (
    patternWithoutPort.startsWith(".") &&
    hostnameWithoutPort.endsWith(patternWithoutPort.slice(1))
  ) {
    return true;
  }

  // TODO IP address ranges

  // TODO CIDR notation

  return false;
}

/**
 * Checks if a hostname should bypass proxy based on NO_PROXY environment variable
 * @param hostname The hostname to check
 * @returns True if the hostname should bypass proxy
 */
export function shouldBypassProxy(
  hostname: string,
  requestOptions: RequestOptions | undefined,
): boolean {
  const ignores = [
    ...getEnvNoProxyPatterns(),
    ...getReqOptionsNoProxyPatterns(requestOptions),
  ];
  const hostLowerCase = hostname.toLowerCase();
  return ignores.some((ignore) =>
    patternMatchesHostname(hostLowerCase, ignore),
  );
}
