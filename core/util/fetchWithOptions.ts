import * as fs from "node:fs";
import tls from "node:tls";
import { http, https } from "follow-redirects";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch, { type RequestInit, type Response } from "node-fetch";
import type { RequestOptions } from "..";

export function fetchwithRequestOptions(
  url: URL,
  init: RequestInit,
  requestOptions?: RequestOptions,
): Promise<Response> {
  const TIMEOUT = 7200; // 7200 seconds = 2 hours

  const ca = [...tls.rootCertificates];
  const customCerts =
    typeof requestOptions?.caBundlePath === "string"
      ? [requestOptions?.caBundlePath]
      : requestOptions?.caBundlePath;
  if (customCerts) {
    ca.push(
      ...customCerts.map((customCert) => fs.readFileSync(customCert, "utf8")),
    );
  }

  const timeout = (requestOptions?.timeout ?? TIMEOUT) * 1000; // measured in ms

  const agentOptions = {
    ca,
    rejectUnauthorized: requestOptions?.verifySsl,
    timeout,
    sessionTimeout: timeout,
    keepAlive: true,
    keepAliveMsecs: timeout,
  };

  const proxy = requestOptions?.proxy;

  // Create agent
  const protocol = url.protocol === "https:" ? https : http;
  const agent = proxy
    ? protocol === https
      ? new HttpsProxyAgent(proxy, agentOptions)
      : new HttpProxyAgent(proxy, agentOptions)
    : new protocol.Agent(agentOptions);

  const headers: { [key: string]: string } = requestOptions?.headers || {};
  for (const [key, value] of Object.entries(init.headers || {})) {
    headers[key] = value as string;
  }

  // Replace localhost with 127.0.0.1
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }

  // add extra body properties if provided
  let updatedBody: string | undefined = undefined;
  try {
    if (requestOptions?.extraBodyProperties && typeof init.body === "string") {
      const parsedBody = JSON.parse(init.body);
      updatedBody = JSON.stringify({
        ...parsedBody,
        ...requestOptions.extraBodyProperties,
      });
    }
  } catch (e) {
    console.log("Unable to parse HTTP request body: ", e);
  }

  // fetch the request with the provided options
  const resp = fetch(url, {
    ...init,
    body: updatedBody ?? init.body,
    headers: headers,
    agent: agent,
  });

  return resp;
}
