import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import tls from "node:tls";
import { CertsCache } from "@continuedev/fetch";
import Bedrock from "./Bedrock";

/**
 * End-to-end TLS tests: a real HTTPS server (cert signed by a throwaway CA)
 * stands in for the Bedrock runtime endpoint, and the real Bedrock class talks
 * to it. Needs the `openssl` CLI to mint the certificates.
 */
function hasOpenssl(): boolean {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const PROXY_ENV = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "NO_PROXY",
  "no_proxy",
  "NODE_EXTRA_CA_CERTS",
];

const maybeDescribe = hasOpenssl() ? describe : describe.skip;

maybeDescribe("Bedrock over TLS (local CA)", () => {
  let dir: string;
  let caPath: string;
  let caPem: string;
  let server: https.Server;
  let proxy: http.Server;
  let serverPort: number;
  let proxyPort: number;
  let connects: string[];
  let savedEnv: Record<string, string | undefined>;

  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bedrock-tls-"));
    openssl(
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      "ca.key",
      "-out",
      "ca.pem",
      "-days",
      "2",
      "-subj",
      "/CN=Test Inspection Root",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    );
    openssl(
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      "srv.key",
      "-out",
      "srv.csr",
      "-subj",
      "/CN=localhost",
    );
    fs.writeFileSync(
      path.join(dir, "ext.cnf"),
      "subjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n",
    );
    openssl(
      "x509",
      "-req",
      "-in",
      "srv.csr",
      "-CA",
      "ca.pem",
      "-CAkey",
      "ca.key",
      "-CAcreateserial",
      "-out",
      "srv.pem",
      "-days",
      "2",
      "-extfile",
      "ext.cnf",
    );
    caPath = path.join(dir, "ca.pem");
    caPem = fs.readFileSync(caPath, "utf8");

    // Fake Bedrock runtime: answers Converse with "ok".
    server = https.createServer(
      {
        key: fs.readFileSync(path.join(dir, "srv.key")),
        cert: fs.readFileSync(path.join(dir, "srv.pem")),
      },
      (req, res) => {
        req.resume();
        req.on("end", () => {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              output: {
                message: { role: "assistant", content: [{ text: "ok" }] },
              },
              stopReason: "end_turn",
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              metrics: { latencyMs: 1 },
            }),
          );
        });
      },
    );
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    serverPort = (server.address() as AddressInfo).port;

    // A CONNECT proxy that tunnels to the fake Bedrock and records targets.
    proxy = http.createServer();
    proxy.on("connect", (req, clientSocket, head) => {
      connects.push(req.url ?? "");
      const upstream = net.connect(serverPort, "127.0.0.1", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });
      upstream.on("error", () => clientSocket.destroy());
      clientSocket.on("error", () => upstream.destroy());
    });
    await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
    proxyPort = (proxy.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    await new Promise((r) => proxy.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await CertsCache.getInstance().clear();
    connects = [];
    savedEnv = {};
    for (const k of PROXY_ENV) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of PROXY_ENV) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    jest.restoreAllMocks();
  });

  const bedrock = (requestOptions?: any) =>
    new Bedrock({
      model: "anthropic.claude-sonnet-4-6",
      region: "us-east-1",
      apiKey: "bedrock-key",
      apiBase: `https://127.0.0.1:${serverPort}`,
      requestOptions,
    });

  it("fails with an actionable hint when the CA is not trusted", async () => {
    // useSystemCa with an empty OS store selects the custom handler (HTTP/1.1)
    // while trusting nothing extra, like an inspected network that hasn't been
    // configured yet.
    jest.spyOn(tls as any, "getCACertificates").mockReturnValue([]);
    await expect(bedrock({ useSystemCa: true }).testModel()).rejects.toThrow(
      /useSystemCa[\s\S]*caBundlePath/,
    );
  });

  it("works when the CA is in requestOptions.caBundlePath", async () => {
    const result = await bedrock({ caBundlePath: caPath }).testModel();
    expect(result.reply).toBe("ok");
  });

  it("works when the CA comes from the OS store (useSystemCa)", async () => {
    jest.spyOn(tls as any, "getCACertificates").mockReturnValue([caPem]);
    const result = await bedrock({ useSystemCa: true }).testModel();
    expect(result.reply).toBe("ok");
  });

  it("does not trust the OS store when useSystemCa is false", async () => {
    jest.spyOn(tls as any, "getCACertificates").mockReturnValue([caPem]);
    await expect(bedrock({ useSystemCa: false }).testModel()).rejects.toThrow();
  });

  it("verifySsl: false skips verification", async () => {
    const result = await bedrock({ verifySsl: false }).testModel();
    expect(result.reply).toBe("ok");
  });

  it("tunnels through requestOptions.proxy", async () => {
    const result = await bedrock({
      caBundlePath: caPath,
      proxy: `http://127.0.0.1:${proxyPort}`,
    }).testModel();
    expect(result.reply).toBe("ok");
    expect(connects).toEqual([`127.0.0.1:${serverPort}`]);
  });

  it("tunnels through HTTPS_PROXY from the environment", async () => {
    process.env.HTTPS_PROXY = `http://127.0.0.1:${proxyPort}`;
    const result = await bedrock({ caBundlePath: caPath }).testModel();
    expect(result.reply).toBe("ok");
    expect(connects).toHaveLength(1);
  });

  it("bypasses the proxy for noProxy hosts", async () => {
    const result = await bedrock({
      caBundlePath: caPath,
      proxy: `http://127.0.0.1:${proxyPort}`,
      noProxy: ["127.0.0.1"],
    }).testModel();
    expect(result.reply).toBe("ok");
    expect(connects).toEqual([]);
  });

  it("surfaces proxy trouble", async () => {
    await expect(
      bedrock({
        caBundlePath: caPath,
        proxy: "http://127.0.0.1:1", // nothing listening
      }).testModel(),
    ).rejects.toThrow();
  });

  it("lists models through the same handler (control plane)", async () => {
    // The control-plane host is bedrock.<region>.amazonaws.com; here we only
    // check that the handler is created and cached per endpoint.
    const llm: any = bedrock({ caBundlePath: caPath });
    const a = await llm._requestHandlerFor(
      "https://bedrock.us-east-1.amazonaws.com",
    );
    const b = await llm._requestHandlerFor(
      "https://bedrock.us-east-1.amazonaws.com",
    );
    expect(a).toBeDefined();
    expect(a).toBe(b);
  });
});

describe("Bedrock without special networking", () => {
  it("leaves the SDK's default handler alone on a plain setup", async () => {
    const saved = { ...process.env };
    for (const k of PROXY_ENV) delete process.env[k];
    try {
      const llm: any = new Bedrock({
        model: "anthropic.claude-sonnet-4-6",
        region: "us-east-1",
        apiKey: "k",
      });
      const handler = await llm._requestHandlerFor(
        "https://bedrock-runtime.us-east-1.amazonaws.com",
      );
      // Linux with no proxy / CA options: nothing to customise (macOS and
      // Windows trust the OS store by default, so they do get a handler).
      if (process.platform === "linux") {
        expect(handler).toBeUndefined();
      }
    } finally {
      process.env = saved;
    }
  });
});
