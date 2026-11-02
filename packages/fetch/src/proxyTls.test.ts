import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net, { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createAgentForUrl } from "./agent.js";
import { CertsCache } from "./certs.js";
import { fetchwithRequestOptions } from "./fetch.js";

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

/**
 * A TLS server whose certificate is signed by a throwaway CA, reached through
 * a CONNECT proxy: the setup of a TLS-inspecting corporate network. The CA
 * must be applied to the handshake with the origin, not only the proxy hop.
 */
describe.skipIf(!hasOpenssl())("custom CA through a proxy", () => {
  let dir: string;
  let caPath: string;
  let server: https.Server;
  let proxy: http.Server;
  let serverPort: number;
  let proxyPort: number;
  let connects: string[] = [];
  let saved: Record<string, string | undefined> = {};

  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-proxy-tls-"));
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

    server = https.createServer(
      {
        key: fs.readFileSync(path.join(dir, "srv.key")),
        cert: fs.readFileSync(path.join(dir, "srv.pem")),
      },
      (req, res) => {
        req.resume();
        req.on("end", () => res.end("hello"));
      },
    );
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    serverPort = (server.address() as AddressInfo).port;

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

  beforeEach(() => {
    connects = [];
    saved = {};
    for (const k of PROXY_ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    CertsCache.getInstance().clear();
  });

  afterEach(() => {
    for (const k of PROXY_ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const url = () => `https://127.0.0.1:${serverPort}/`;
  const proxyUrl = () => `http://127.0.0.1:${proxyPort}`;

  test("fetchwithRequestOptions trusts caBundlePath through the proxy", async () => {
    const resp = await fetchwithRequestOptions(
      url(),
      {},
      { caBundlePath: caPath, proxy: proxyUrl() },
    );
    expect(await resp.text()).toBe("hello");
    expect(connects).toEqual([`127.0.0.1:${serverPort}`]);
  });

  test("without the CA the proxied request is rejected", async () => {
    await expect(
      fetchwithRequestOptions(url(), {}, { proxy: proxyUrl() }),
    ).rejects.toThrow(/certificate/i);
  });

  test("createAgentForUrl applies the CA to the tunnelled handshake", async () => {
    const { agent } = await createAgentForUrl(url(), {
      caBundlePath: caPath,
      proxy: proxyUrl(),
    });
    const body = await new Promise<string>((resolve, reject) => {
      const req = https.request(url(), { agent }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.end();
    });
    expect(body).toBe("hello");
    expect(connects).toHaveLength(1);
  });

  test("verifySsl: false is honoured through the proxy", async () => {
    const resp = await fetchwithRequestOptions(
      url(),
      {},
      { verifySsl: false, proxy: proxyUrl() },
    );
    expect(await resp.text()).toBe("hello");
  });
});
