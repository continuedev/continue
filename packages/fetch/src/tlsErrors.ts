const UNTRUSTED_CERT_CODES = new Set([
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_UNTRUSTED",
]);

/** Walks `error`, `error.cause`, ... (bounded) collecting codes and messages. */
function errorChain(error: unknown): { codes: string[]; messages: string[] } {
  const codes: string[] = [];
  const messages: string[] = [];
  let current: any = error;
  for (let depth = 0; current && depth < 6; depth++) {
    if (typeof current.code === "string") codes.push(current.code);
    if (typeof current.message === "string") messages.push(current.message);
    current = current.cause;
  }
  return { codes, messages };
}

/**
 * One-line, actionable explanation for TLS / proxy connection failures, or
 * undefined when the error is something else. Looks through `cause` chains
 * because HTTP clients often wrap the real error ("Connection error.").
 */
export function getTlsErrorHint(error: unknown): string | undefined {
  const { codes, messages } = errorChain(error);
  const text = messages.join(" ");

  if (
    codes.some((c) => UNTRUSTED_CERT_CODES.has(c)) ||
    /unable to (get local issuer|verify the first)|self[- ]signed certificate/i.test(
      text,
    )
  ) {
    return "The server's TLS certificate isn't trusted. If your network inspects TLS (corporate proxy), set `requestOptions.useSystemCa: true` to trust the OS certificate store, or `requestOptions.caBundlePath` to your organisation's root certificate (or set NODE_EXTRA_CA_CERTS).";
  }
  if (
    codes.includes("CERT_HAS_EXPIRED") ||
    /certificate has expired/i.test(text)
  ) {
    return "The server's TLS certificate has expired. Check the system clock, or the certificate presented by your proxy.";
  }
  if (
    codes.includes("ERR_TLS_CERT_ALTNAME_INVALID") ||
    /Hostname\/IP does not match certificate/i.test(text)
  ) {
    return "The certificate doesn't match the host name. Check `apiBase`/the region, and that your proxy isn't presenting a certificate for a different host.";
  }
  if (/\b407\b|proxy authentication required/i.test(text)) {
    return "The proxy requires authentication (407). Put credentials in the proxy URL, e.g. `requestOptions.proxy: http://user:pass@proxy:3128`.";
  }
  if (
    codes.includes("ECONNREFUSED") &&
    /proxy/i.test(text + (process.env.HTTPS_PROXY ?? ""))
  ) {
    return "Could not connect to the proxy. Check `requestOptions.proxy` / HTTPS_PROXY.";
  }
  return undefined;
}
