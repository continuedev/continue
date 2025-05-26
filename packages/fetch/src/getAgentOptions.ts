import { globalAgent } from "https";
import * as fs from "node:fs";
import tls from "node:tls";

import { RequestOptions } from "@continuedev/config-types";

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
      ...customCerts.map((customCert) => fs.readFileSync(customCert, "utf8")),
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
    agentOptions.cert = fs.readFileSync(
      requestOptions.clientCertificate.cert,
      "utf8",
    );
    agentOptions.key = fs.readFileSync(
      requestOptions.clientCertificate.key,
      "utf8",
    );
    if (requestOptions.clientCertificate.passphrase) {
      agentOptions.passphrase = requestOptions.clientCertificate.passphrase;
    }
  }

  return agentOptions;
}
