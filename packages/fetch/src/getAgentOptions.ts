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

  const certsCache = CertsCache.getInstance();
  const ca = await certsCache.getCa(requestOptions?.caBundlePath);

  const agentOptions: { [key: string]: any } = {
    ca,
    rejectUnauthorized: requestOptions?.verifySsl,
    timeout,
    sessionTimeout: timeout,
    keepAlive: true,
    // keepAliveMsecs: Delay before sending TCP keep-alive probes (node default = 1000ms)
    // Setting this to 1s ensures connections stay alive through network devices
    // (proxies, load balancers, firewalls) that close idle connections after 30-350s
    // This should prevent "premature close" errors during long LLM streaming responses
    keepAliveMsecs: 1000,
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

  if (process.env.VERBOSE_FETCH) {
    console.log(`Fetch agent options:`);
    console.log(`\tTimeout (sessionTimeout): ${agentOptions.timeout}`);
    console.log(`\tkeepAliveMsecs: ${agentOptions.keepAliveMsecs}`);
    console.log(`\tTotal CA certs: ${ca.length}`);
    console.log(`\tGlobal/Root CA certs: ${certsCache.fixedCa.length}`);
    console.log(`\tCustom CA certs: ${ca.length - certsCache.fixedCa.length}`);
    console.log(
      `\tClient certificate: ${requestOptions?.clientCertificate ? "Yes" : "No"}`,
    );
    console.log(
      `\trejectUnauthorized/verifySsl: ${agentOptions.rejectUnauthorized ?? "not set (defaults to true)"}`,
    );
  }

  return agentOptions;
}
