import { globalAgent } from "https";
import * as fs from "node:fs";
import tls from "node:tls";

import { RequestOptions } from "@continuedev/config-types";

/**
 * Extracts content from either a file path or data URI
 */
function getCertificateContent(input: string): string {
  if (input.startsWith("data:")) {
    // Parse data URI: data:[<mediatype>][;base64],<data>
    const [header, data] = input.split(",");
    if (header.includes("base64")) {
      return Buffer.from(data, "base64").toString("utf8");
    } else {
      return decodeURIComponent(data);
    }
  } else {
    // Assume it's a file path
    return fs.readFileSync(input, "utf8");
  }
}

/**
 * Prepares agent options based on request options and certificates
 */
export function getAgentOptions(requestOptions?: RequestOptions): {
  [key: string]: any;
} {
  const TIMEOUT = 7200; // 7200 seconds = 2 hours
  const timeout = (requestOptions?.timeout ?? TIMEOUT) * 1000; // measured in ms

  // Get root certificates
  let globalCerts: string[] = [];
  if (process.env.IS_BINARY) {
    if (Array.isArray(globalAgent.options.ca)) {
      globalCerts = [...globalAgent.options.ca.map((cert) => cert.toString())];
    } else if (typeof globalAgent.options.ca !== "undefined") {
      globalCerts.push(globalAgent.options.ca.toString());
    }
  }

  const ca = Array.from(new Set([...tls.rootCertificates, ...globalCerts]));
  const customCerts =
    typeof requestOptions?.caBundlePath === "string"
      ? [requestOptions?.caBundlePath]
      : requestOptions?.caBundlePath;
  if (customCerts) {
    ca.push(
      ...customCerts.map((customCert) => getCertificateContent(customCert)),
    );
  }

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
