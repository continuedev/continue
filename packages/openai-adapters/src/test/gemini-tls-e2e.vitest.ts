import { execSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { TLSSocket } from "node:tls";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GeminiApi } from "../apis/Gemini.js";
import { sseChunk } from "./gemini-test-helpers.js";

/**
 * TLS and mutual-TLS behavior through the REAL @google/genai SDK and the REAL
 * customFetch/fetchwithRequestOptions stack (no mocks): local HTTPS stub
 * Gemini servers backed by an openssl mini-CA. Certificate choreography
 * adapts packages/fetch/src/fetch.e2e.test.ts and the standard openssl
 * CA-sign recipe (see also Node core's tls-client-verify tests).
 */

let tempDir: string;
let tlsServer: https.Server;
let mtlsServer: https.Server;
let tlsPort: number;
let mtlsPort: number;
let caCertPath: string;
let clientCertPath: string;
let clientKeyPath: string;
let clientEncryptedKeyPath: string;

/** Client identities the mTLS server actually observed, per request. */
const mtlsObserved: { authorized: boolean; cn: string | undefined }[] = [];

const CLIENT_CN = "continue-mtls-client";
const CLIENT_KEY_PASSPHRASE = "test-passphrase";

/**
 * Mini-CA: CA keypair, a CA-signed server certificate for 127.0.0.1, and a
 * CA-signed client certificate (plus a passphrase-encrypted copy of the
 * client key). Same openssl toolchain as packages/fetch.
 */
function generateMiniCa(dir: string): void {
  const run = (cmd: string) => execSync(cmd, { stdio: "pipe" });

  // CA
  run(`openssl genrsa -out "${path.join(dir, "ca.key")}" 2048`);
  run(
    `openssl req -x509 -new -key "${path.join(dir, "ca.key")}" -out "${path.join(dir, "ca.crt")}" -days 365 -subj "/C=US/O=Continue Test CA/CN=Continue Test CA"`,
  );

  // Server certificate (SAN: 127.0.0.1 / localhost), signed by the CA
  const serverConf = path.join(dir, "server.conf");
  fs.writeFileSync(
    serverConf,
    `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
O = Continue TLS Test
CN = 127.0.0.1

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
IP.1 = 127.0.0.1
DNS.1 = localhost
`,
  );
  run(`openssl genrsa -out "${path.join(dir, "server.key")}" 2048`);
  run(
    `openssl req -new -key "${path.join(dir, "server.key")}" -out "${path.join(dir, "server.csr")}" -config "${serverConf}"`,
  );
  run(
    `openssl x509 -req -in "${path.join(dir, "server.csr")}" -CA "${path.join(dir, "ca.crt")}" -CAkey "${path.join(dir, "ca.key")}" -CAcreateserial -out "${path.join(dir, "server.crt")}" -days 365 -extensions v3_req -extfile "${serverConf}"`,
  );

  // Client certificate (clientAuth EKU), signed by the same CA
  const clientExt = path.join(dir, "client.ext");
  fs.writeFileSync(clientExt, "extendedKeyUsage = clientAuth\n");
  run(`openssl genrsa -out "${path.join(dir, "client.key")}" 2048`);
  run(
    `openssl req -new -key "${path.join(dir, "client.key")}" -out "${path.join(dir, "client.csr")}" -subj "/C=US/O=Continue TLS Test/CN=${CLIENT_CN}"`,
  );
  run(
    `openssl x509 -req -in "${path.join(dir, "client.csr")}" -CA "${path.join(dir, "ca.crt")}" -CAkey "${path.join(dir, "ca.key")}" -CAcreateserial -out "${path.join(dir, "client.crt")}" -days 365 -extfile "${clientExt}"`,
  );

  // Passphrase-encrypted copy of the client key (schema's passphrase field)
  run(
    `openssl rsa -in "${path.join(dir, "client.key")}" -aes256 -passout pass:${CLIENT_KEY_PASSPHRASE} -out "${path.join(dir, "client-encrypted.key")}"`,
  );
}

function sseHandler(
  _req: unknown,
  res: import("node:http").ServerResponse,
): void {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  res.write(sseChunk("secure ", undefined));
  res.write(sseChunk("stream", "STOP"));
  res.end();
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-tls-test-"));
  generateMiniCa(tempDir);
  caCertPath = path.join(tempDir, "ca.crt");
  clientCertPath = path.join(tempDir, "client.crt");
  clientKeyPath = path.join(tempDir, "client.key");
  clientEncryptedKeyPath = path.join(tempDir, "client-encrypted.key");

  // Plain TLS server (no client-cert requirement)
  tlsServer = https.createServer(
    {
      cert: fs.readFileSync(path.join(tempDir, "server.crt")),
      key: fs.readFileSync(path.join(tempDir, "server.key")),
    },
    sseHandler,
  );
  await new Promise<void>((resolve) =>
    tlsServer.listen(0, "127.0.0.1", resolve),
  );
  tlsPort = (tlsServer.address() as AddressInfo).port;

  // Mutual-TLS server: demands a client certificate signed by our CA
  mtlsServer = https.createServer(
    {
      cert: fs.readFileSync(path.join(tempDir, "server.crt")),
      key: fs.readFileSync(path.join(tempDir, "server.key")),
      ca: fs.readFileSync(caCertPath),
      requestCert: true,
      rejectUnauthorized: true,
    },
    (req, res) => {
      const socket = req.socket as TLSSocket;
      const cn = socket.getPeerCertificate()?.subject?.CN;
      mtlsObserved.push({
        authorized: socket.authorized,
        cn: Array.isArray(cn) ? cn[0] : cn,
      });
      sseHandler(req, res);
    },
  );
  await new Promise<void>((resolve) =>
    mtlsServer.listen(0, "127.0.0.1", resolve),
  );
  mtlsPort = (mtlsServer.address() as AddressInfo).port;
  // Seven sequential openssl invocations — generous timeout for contended
  // CI workers (runs in ~1s locally).
}, 30_000);

afterAll(async () => {
  await new Promise((resolve) => tlsServer.close(resolve));
  await new Promise((resolve) => mtlsServer.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeApi(
  port: number,
  requestOptions: Record<string, unknown>,
): GeminiApi {
  return new GeminiApi({
    provider: "gemini",
    apiKey: "stub-key",
    apiBase: `https://127.0.0.1:${port}/v1beta/`,
    requestOptions,
  });
}

async function drainChat(api: GeminiApi): Promise<string> {
  let content = "";
  for await (const chunk of api.chatCompletionStream(
    {
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    },
    new AbortController().signal,
  )) {
    content += chunk.choices[0]?.delta?.content ?? "";
  }
  return content;
}

describe("Gemini TLS through the real SDK (no mocks)", () => {
  beforeEach(() => {
    // Deterministic under ambient corporate proxy environments — without
    // this, a machine with HTTPS_PROXY set routes these stub-server calls
    // into the proxy and the whole suite fails for non-TLS reasons.
    vi.stubEnv("HTTP_PROXY", "");
    vi.stubEnv("http_proxy", "");
    vi.stubEnv("HTTPS_PROXY", "");
    vi.stubEnv("https_proxy", "");
    vi.stubEnv("NO_PROXY", "");
    vi.stubEnv("no_proxy", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("rejects a server signed by an unknown CA when verifySsl is on", async () => {
    await expect(
      drainChat(makeApi(tlsPort, { verifySsl: true })),
    ).rejects.toThrow(
      /self-signed|self signed|unable to verify|certificate|unknown ca/i,
    );
  });

  it("accepts the server when its CA is trusted via caBundlePath", async () => {
    const content = await drainChat(
      makeApi(tlsPort, { caBundlePath: caCertPath }),
    );
    expect(content).toBe("secure stream");
  });

  it("accepts the server when verifySsl is explicitly disabled", async () => {
    const content = await drainChat(makeApi(tlsPort, { verifySsl: false }));
    expect(content).toBe("secure stream");
  });
});

describe("Gemini mutual TLS through the real SDK (no mocks)", () => {
  beforeEach(() => {
    vi.stubEnv("HTTP_PROXY", "");
    vi.stubEnv("http_proxy", "");
    vi.stubEnv("HTTPS_PROXY", "");
    vi.stubEnv("https_proxy", "");
    vi.stubEnv("NO_PROXY", "");
    vi.stubEnv("no_proxy", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("rejects the handshake when the server requires a client certificate and none is configured", async () => {
    await expect(
      drainChat(makeApi(mtlsPort, { caBundlePath: caCertPath })),
    ).rejects.toThrow(
      /certificate required|alert|socket hang up|ECONNRESET|EPROTO/i,
    );
    expect(mtlsObserved).toHaveLength(0);
  });

  it("completes the handshake and streams when clientCertificate is configured", async () => {
    const before = mtlsObserved.length;
    const content = await drainChat(
      makeApi(mtlsPort, {
        caBundlePath: caCertPath,
        clientCertificate: { cert: clientCertPath, key: clientKeyPath },
      }),
    );

    expect(content).toBe("secure stream");
    const observed = mtlsObserved[before];
    expect(observed.authorized).toBe(true);
    expect(observed.cn).toBe(CLIENT_CN);
  });

  it("supports a passphrase-protected client key", async () => {
    const before = mtlsObserved.length;
    const content = await drainChat(
      makeApi(mtlsPort, {
        caBundlePath: caCertPath,
        clientCertificate: {
          cert: clientCertPath,
          key: clientEncryptedKeyPath,
          passphrase: CLIENT_KEY_PASSPHRASE,
        },
      }),
    );

    expect(content).toBe("secure stream");
    expect(mtlsObserved[before].authorized).toBe(true);
  });
});
