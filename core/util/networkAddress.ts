import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Whether an IP address is not on the public internet: loopback, private
 * ranges, link-local (which includes the cloud metadata address
 * 169.254.169.254), carrier-grade NAT, unspecified, and the IPv6 equivalents.
 */
export function isNonPublicAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "");
  const kind = isIP(ip);
  if (kind === 4) return isNonPublicIPv4(ip);
  if (kind === 6) {
    const lower = ip.toLowerCase();
    // IPv4-mapped (::ffff:a.b.c.d) is judged by its IPv4 address.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isNonPublicIPv4(mapped[1]);
    if (lower === "::1" || lower === "::") return true;
    const first = parseInt(lower.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    return false;
  }
  return false;
}

function isNonPublicIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Names that never point at a public host. */
const NON_PUBLIC_NAME = /(^|\.)(localhost|local|internal|home\.arpa)$/i;

/** Judged from the hostname alone (no DNS): literal addresses and local names. */
export function isNonPublicHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isIP(host)) return isNonPublicAddress(host);
  return NON_PUBLIC_NAME.test(host);
}

export type Resolver = (hostname: string) => Promise<string[]>;

const resolveAll: Resolver = async (hostname) =>
  (await lookup(hostname, { all: true })).map((r) => r.address);

/**
 * Whether a hostname is, or resolves to, a non-public address. A name that
 * cannot be resolved is not treated as non-public (the fetch will fail).
 */
export async function resolvesToNonPublic(
  hostname: string,
  resolve: Resolver = resolveAll,
): Promise<boolean> {
  if (isNonPublicHostname(hostname)) return true;
  try {
    return (await resolve(hostname.replace(/^\[|\]$/g, ""))).some(
      isNonPublicAddress,
    );
  } catch {
    return false;
  }
}
