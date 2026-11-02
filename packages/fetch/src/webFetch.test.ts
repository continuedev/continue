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
import { CertsCache } from "./certs.js";
import { createWebFetch } from "./webFetch.js";

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

describe.skipIf(!hasOpenssl())("createWebFetch", () => {
  let dir: string;
  let caPath: string;
  let server: https.Server;
  let plain: http.Server;
  let proxy: http.Server;
  let port: number;
  let plainPort: number;
  let proxyPort: number;
  let connects: string[] = [];
  let saved: Record<string, string | undefined> = {};
  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });

  const handler: http.RequestListener = (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      if (req.url === "/echo") {
        res.setHeader("content-type", "application/json");
        return res.end(
          JSON.stringify({
            method: req.method,
            body,
            auth: req.headers.authorization ?? null,
            contentType: req.headers["content-type"] ?? null,
          }),
        );
      }
      if (req.url === "/stream") {
        res.setHeader("content-type", "text/event-stream");
        res.write("data: one\n\n");
        setTimeout(() => {
          res.write("data: two\n\n");
          res.end();
        }, 50);
        return;
      }
      if (req.url === "/redirect") {
        res.writeHead(302, { location: "/echo" });
        return res.end();
      }
      if (req.url === "/loop") {
        res.writeHead(302, { location: "/loop" });
        return res.end();
      }
      if (req.url === "/nocontent") {
        res.writeHead(204);
        return res.end();
      }
      if (req.url === "/hang") {
        return; // never answers
      }
      res.writeHead(404);
      res.end("nope");
    });
  };

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "webfetch-"));
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
      "/CN=Test Root",
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
      handler,
    );
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;

    plain = http.createServer(handler);
    await new Promise<void>((r) => plain.listen(0, "127.0.0.1", r));
    plainPort = (plain.address() as AddressInfo).port;

    proxy = http.createServer();
    proxy.on("connect", (req, clientSocket, head) => {
      connects.push(req.url ?? "");
      const upstream = net.connect(port, "127.0.0.1", () => {
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
    server.closeAllConnections?.();
    plain.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    await new Promise((r) => plain.close(r));
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

  const url = (p = "/echo") => `https://127.0.0.1:${port}${p}`;

  test("returns a real Response from a server signed by a custom CA", async () => {
    const f = createWebFetch({ caBundlePath: caPath });
    const resp = await f(url(), {
      method: "POST",
      body: "hello",
      headers: { authorization: "Bearer t", "content-type": "text/plain" },
    });
    expect(resp).toBeInstanceOf(Response);
    expect(resp.ok).toBe(true);
    expect(resp.headers.get("content-type")).toBe("application/json");
    expect(await resp.json()).toEqual({
      method: "POST",
      body: "hello",
      auth: "Bearer t",
      contentType: "text/plain",
    });
  });

  test("an untrusted CA is rejected", async () => {
    await expect(createWebFetch()(url())).rejects.toThrow(/certificate/i);
  });

  test("verifySsl: false skips verification", async () => {
    const resp = await createWebFetch({ verifySsl: false })(url());
    expect(resp.status).toBe(200);
  });

  test("goes through a proxy and still applies the CA to the origin", async () => {
    const f = createWebFetch({
      caBundlePath: caPath,
      proxy: `http://127.0.0.1:${proxyPort}`,
    });
    const resp = await f(url());
    expect((await resp.json()).method).toBe("GET");
    expect(connects).toEqual([`127.0.0.1:${port}`]);
  });

  test("honours noProxy", async () => {
    const f = createWebFetch({
      caBundlePath: caPath,
      proxy: `http://127.0.0.1:${proxyPort}`,
      noProxy: ["127.0.0.1"],
    });
    await f(url());
    expect(connects).toEqual([]);
  });

  test("streams the response body incrementally", async () => {
    const resp = await createWebFetch({ caBundlePath: caPath })(url("/stream"));
    const reader = resp.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe("data: one\n\n");
    let rest = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest += new TextDecoder().decode(value);
    }
    expect(rest).toBe("data: two\n\n");
  });

  test("cancel() works on the body (the MCP SDK calls it)", async () => {
    const resp = await createWebFetch({ caBundlePath: caPath })(url("/stream"));
    await expect(resp.body!.cancel()).resolves.toBeUndefined();
  });

  test("follows redirects and switches POST to GET like a browser", async () => {
    const f = createWebFetch({ caBundlePath: caPath });
    const resp = await f(url("/redirect"), {
      method: "POST",
      body: "x",
      headers: { "content-type": "text/plain" },
    });
    const data = await resp.json();
    expect(data.method).toBe("GET");
    expect(data.body).toBe("");
  });

  test("redirect: 'error' and redirect loops fail", async () => {
    const f = createWebFetch({ caBundlePath: caPath });
    await expect(f(url("/redirect"), { redirect: "error" })).rejects.toThrow(
      /redirect/i,
    );
    await expect(f(url("/loop"))).rejects.toThrow(/redirects/i);
  });

  test("204 responses have no body", async () => {
    const resp = await createWebFetch({ caBundlePath: caPath })(
      url("/nocontent"),
    );
    expect(resp.status).toBe(204);
    expect(resp.body).toBeNull();
  });

  test("non-2xx responses are returned, not thrown", async () => {
    const resp = await createWebFetch({ caBundlePath: caPath })(
      url("/missing"),
    );
    expect(resp.status).toBe(404);
    expect(resp.ok).toBe(false);
    expect(await resp.text()).toBe("nope");
  });

  test("accepts URLSearchParams and Uint8Array bodies", async () => {
    const f = createWebFetch({ caBundlePath: caPath });
    const form = await (
      await f(url(), {
        method: "POST",
        body: new URLSearchParams({ a: "1", b: "2" }),
      })
    ).json();
    expect(form.body).toBe("a=1&b=2");
    const bytes = await (
      await f(url(), { method: "POST", body: new TextEncoder().encode("raw") })
    ).json();
    expect(bytes.body).toBe("raw");
  });

  test("an abort signal cancels a request that never answers", async () => {
    const controller = new AbortController();
    const pending = createWebFetch({ caBundlePath: caPath })(url("/hang"), {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    await expect(pending).rejects.toBeDefined();
  });

  test("plain http works too", async () => {
    const resp = await createWebFetch()(`http://127.0.0.1:${plainPort}/echo`);
    expect(resp.status).toBe(200);
  });
});
