import {
  createAgentForUrl,
  defaultUseSystemCa,
  needsCustomAgent,
} from "@continuedev/fetch";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { RequestOptions } from "../../index.js";

/**
 * Request handler for the AWS SDK clients that applies the same networking
 * settings as the rest of Continue's model requests: proxy (`proxy`,
 * HTTP(S)_PROXY, `noProxy` / NO_PROXY), extra CAs (`caBundlePath`,
 * NODE_EXTRA_CA_CERTS), the OS certificate store (`useSystemCa`, on by
 * default on Windows and macOS), client certificates and `verifySsl`.
 *
 * The AWS SDK ignores all of these by default, so under a TLS-inspecting proxy
 * Bedrock fails with "unable to get local issuer certificate".
 *
 * Returns undefined when nothing needs customising, leaving the SDK's default
 * handler (and its behaviour) untouched.
 */
export async function createBedrockRequestHandler(
  endpoint: string,
  requestOptions: RequestOptions | undefined,
): Promise<NodeHttpHandler | undefined> {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return undefined;
  }
  if (!needsCustomAgent(url, requestOptions, defaultUseSystemCa())) {
    return undefined;
  }
  const { agent } = await createAgentForUrl(url, requestOptions);
  return new NodeHttpHandler(
    url.protocol === "https:" ? { httpsAgent: agent } : { httpAgent: agent },
  );
}
