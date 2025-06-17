import { RequestOptions } from "@continuedev/config-types";
import { CertsCache, getCertificateContent } from "./certs.js";

/**
 * Prepares agent options based on request options and certificates
 */
export async function getAgentOptions(
  requestOptions?: RequestOptions,
): Promise<{
  [key: string]: any;
}> {
  const TIMEOUT = 7200; // 7200 seconds = 2 hours
  const timeout = (requestOptions?.timeout ?? TIMEOUT) * 1000; // measured in ms

  const ca = await CertsCache.getInstance().getCa(requestOptions?.caBundlePath);

  const agentOptions: { [key: string]: any } = {
    ca,
    rejectUnauthorized: requestOptions?.verifySsl,
    timeout,
    sessionTimeout: timeout,
    keepAlive: true,
    keepAliveMsecs: timeout,
  };

  // Handle ClientCertificateOptions
  if (requestOptions?.clientCertificate) {
    const { cert, key, passphrase } = requestOptions.clientCertificate;

    agentOptions.cert = getCertificateContent(cert);
    agentOptions.key = getCertificateContent(key);

    if (requestOptions.clientCertificate.passphrase) {
      agentOptions.passphrase = passphrase;
    }
  }

  return agentOptions;
}
