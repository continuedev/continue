import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { FetchFunction } from "../index.js";

const MAX_REDIRECTS = 20;

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return false;
  }
  const [a, b, c] = parts;
  if (a === 0) return false;
  if (a === 10) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && b >= 18 && b <= 19) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return false;
  if (lower.startsWith("::ffff:")) return isPublicIp(lower.slice(7));
  if (lower.startsWith("::")) return false;
  const hextets = lower.split(":");
  const first = parseInt(hextets[0], 16);
  const second = parseInt(hextets[1], 16);
  if (Number.isNaN(first)) return false;
  if (first === 0x64 && second === 0xff9b) return false;
  if (first === 0x100) return false;
  if (first === 0x2001 && second === 0xdb8) return false;
  if (first >= 0xfc00 && first <= 0xfdff) return false;
  if (first >= 0xfe80 && first <= 0xfebf) return false;
  if (first >= 0xff00) return false;
  return true;
}

export function isPublicIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPublicIpv4(ip);
  if (version === 6) return isPublicIpv6(ip);
  return false;
}

// Every resolved address must be public: a single private answer is enough
// to refuse, since the transport may use any of them.
export async function assertPublicUrl(url: URL | string): Promise<URL> {
  const parsed = typeof url === "string" ? new URL(url) : url;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Refusing non-HTTP(S) fetch target: ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  if (isIP(host) !== 0) {
    if (!isPublicIp(host)) {
      throw new Error(`Refusing non-public fetch target: ${host}`);
    }
    return parsed;
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Refusing fetch target with unresolvable host: ${host}`);
  }
  if (addresses.length === 0 || addresses.some((a) => !isPublicIp(a.address))) {
    throw new Error(
      `Refusing fetch target resolving to a non-public address: ${host}`,
    );
  }
  return parsed;
}

// Fetch through an opaque fetch function with the target re-validated on
// every redirect hop. Transports that follow redirects below the fetch
// layer are caught by the final-URL check, so their content is never used.
export async function safeFetch(
  fetchFn: FetchFunction,
  url: string | URL,
  init?: any,
): Promise<any> {
  let current = await assertPublicUrl(url);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const resp = await fetchFn(current, { ...init, redirect: "manual" });
    const status = resp.status;
    if (status >= 300 && status < 400) {
      const location = resp.headers?.get?.("location");
      if (!location) {
        return resp;
      }
      current = await assertPublicUrl(new URL(location, current));
      continue;
    }
    if (typeof resp.url === "string" && resp.url) {
      const final = new URL(resp.url);
      if (final.href !== current.href) {
        await assertPublicUrl(final);
      }
    }
    return resp;
  }
  throw new Error("Too many redirects");
}
