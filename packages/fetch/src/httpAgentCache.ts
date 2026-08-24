import { RequestOptions } from "@continuedev/config-types";
import * as followRedirects from "follow-redirects";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getAgentOptions } from "./getAgentOptions.js";

const { http, https } = (followRedirects as any).default;

export function agentCacheKey(
  protocol: string,
  proxy: string | undefined,
  shouldBypass: boolean,
  requestOptions?: RequestOptions,
): string {
  const ca = requestOptions?.caBundlePath;
  const caPart = Array.isArray(ca) ? [...ca].sort().join("|") : (ca ?? "");
  const client = requestOptions?.clientCertificate;
  return JSON.stringify({
    protocol,
    proxy: shouldBypass ? "" : (proxy ?? ""),
    timeout: requestOptions?.timeout ?? null,
    verifySsl: requestOptions?.verifySsl ?? null,
    ca: caPart,
    cert: client?.cert ?? "",
    key: client?.key ?? "",
    passphrase: client?.passphrase ?? "",
  });
}

const agentCache = new Map<string, Promise<{ destroy?: () => void }>>();

function createAgent(
  protocol: string,
  proxy: string | undefined,
  shouldBypass: boolean,
  agentOptions: { [key: string]: any },
) {
  const httpModule = protocol === "https:" ? https : http;
  if (proxy && !shouldBypass) {
    return protocol === "https:"
      ? new HttpsProxyAgent(proxy, agentOptions)
      : new HttpProxyAgent(proxy, agentOptions);
  }
  return new httpModule.Agent(agentOptions);
}

export async function getOrCreateAgent(
  protocol: string,
  proxy: string | undefined,
  shouldBypass: boolean,
  requestOptions?: RequestOptions,
) {
  const key = agentCacheKey(protocol, proxy, shouldBypass, requestOptions);
  const cached = agentCache.get(key);
  if (cached) {
    return cached;
  }
  const pending = (async () => {
    const agentOptions = await getAgentOptions(requestOptions);
    return createAgent(protocol, proxy, shouldBypass, agentOptions);
  })();
  agentCache.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    if (agentCache.get(key) === pending) {
      agentCache.delete(key);
    }
    throw error;
  }
}

export async function clearHttpAgentCache() {
  const pending = [...agentCache.values()];
  agentCache.clear();
  for (const created of pending) {
    try {
      const agent = await created;
      agent.destroy?.();
    } catch {
      // Creation failed; nothing to destroy.
    }
  }
}
