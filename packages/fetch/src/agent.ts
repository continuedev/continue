import { RequestOptions } from "./types.js";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getAgentOptions } from "./getAgentOptions.js";
import { getProxy, shouldBypassProxy } from "./util.js";

/**
 * `HttpsProxyAgent` that also applies the TLS options (CA, client certificate,
 * `rejectUnauthorized`) to the handshake with the *origin* server.
 *
 * The stock agent only uses its options to reach the proxy and discards them
 * for the tunnelled connection, so a custom CA, the system store or a client
 * certificate silently stopped working as soon as a proxy was in use, which
 * is exactly the TLS-inspecting-proxy case.
 */
export class HttpsProxyAgentWithTls extends HttpsProxyAgent<string> {
  private readonly originTlsOptions: Record<string, unknown>;

  constructor(proxy: string, agentOptions: Record<string, any>) {
    super(proxy, agentOptions);
    const tlsOptions: Record<string, unknown> = {};
    for (const key of [
      "ca",
      "cert",
      "key",
      "passphrase",
      "rejectUnauthorized",
    ]) {
      if (agentOptions[key] !== undefined) {
        tlsOptions[key] = agentOptions[key];
      }
    }
    this.originTlsOptions = tlsOptions;
  }

  async connect(req: any, opts: any) {
    // Per-request options (host, port, servername, ...) win over ours.
    return super.connect(req, { ...this.originTlsOptions, ...opts });
  }
}

/**
 * Builds the HTTP(S) agent that `fetchwithRequestOptions` would use for `url`:
 * trusted CAs (bundled, `NODE_EXTRA_CA_CERTS`, `caBundlePath`, system store),
 * client certificate, `verifySsl`, and the proxy from `requestOptions.proxy`
 * or `HTTP(S)_PROXY`, honouring `noProxy` / `NO_PROXY`.
 *
 * For clients that bring their own HTTP stack (e.g. the AWS SDK) and would
 * otherwise ignore these settings.
 */
export async function createAgentForUrl(
  url: URL | string,
  requestOptions?: RequestOptions,
): Promise<{ agent: HttpAgent | HttpsAgent; proxy?: string }> {
  const target = typeof url === "string" ? new URL(url) : url;
  const agentOptions = await getAgentOptions(requestOptions);
  const proxy = getProxy(target.protocol, requestOptions);
  const bypass = shouldBypassProxy(target.hostname, requestOptions);
  const useProxy = !!proxy && !bypass;

  if (target.protocol === "https:") {
    return {
      agent: useProxy
        ? new HttpsProxyAgentWithTls(proxy, agentOptions)
        : new HttpsAgent(agentOptions),
      proxy: useProxy ? proxy : undefined,
    };
  }
  return {
    agent: useProxy
      ? new HttpProxyAgent(proxy, agentOptions)
      : new HttpAgent(agentOptions),
    proxy: useProxy ? proxy : undefined,
  };
}

/**
 * True when these options (or the environment) need more than a client's
 * default networking: a proxy for this URL, custom/system CAs, a client
 * certificate, or disabled verification.
 */
export function needsCustomAgent(
  url: URL | string,
  requestOptions?: RequestOptions,
  defaultUseSystemCa = false,
): boolean {
  const target = typeof url === "string" ? new URL(url) : url;
  const proxy = getProxy(target.protocol, requestOptions);
  if (proxy && !shouldBypassProxy(target.hostname, requestOptions)) {
    return true;
  }
  return !!(
    requestOptions?.caBundlePath ||
    requestOptions?.clientCertificate ||
    requestOptions?.verifySsl === false ||
    (requestOptions?.useSystemCa ?? defaultUseSystemCa)
  );
}
