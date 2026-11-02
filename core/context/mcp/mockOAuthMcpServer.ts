import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net, { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

/**
 * Test helpers: a mock MCP server that demands a bearer token plus a mock
 * OAuth authorization server (dynamic client registration, PKCE, refresh),
 * optionally over HTTPS with a throwaway CA, and a CONNECT proxy.
 */

export interface MockOptions {
  /** Send a WWW-Authenticate challenge pointing at the metadata URL. */
  challenge?: boolean;
  /** Serve OAuth metadata at a non-standard path (only the challenge reveals it). */
  customMetadataPath?: string;
  /** Body of the 401 response; real servers rarely say "401" or "Unauthorized". */
  unauthorizedBody?: string;
  /** Serve over HTTPS with this key / certificate. */
  tls?: { key: string; cert: string };
}

export class MockOAuthMcpServer {
  server!: http.Server | https.Server;
  base = "";
  port = 0;
  readonly requests: string[] = [];
  readonly grants: string[] = [];
  private codes = new Map<string, { challenge: string }>();
  validAccess = new Set<string>();
  validRefresh = new Set<string>();
  private counter = 0;

  constructor(private options: MockOptions = {}) {}

  async start() {
    const listener = (req: http.IncomingMessage, res: http.ServerResponse) =>
      void this.handle(req, res);
    this.server = this.options.tls
      ? https.createServer(this.options.tls, listener)
      : http.createServer(listener);
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.port = (this.server.address() as AddressInfo).port;
    this.base = `${this.options.tls ? "https" : "http"}://127.0.0.1:${this.port}`;
  }

  async stop() {
    // Node 18.2+; older @types/node (the VS Code extension typechecks this file) lack it
    (this.server as any).closeAllConnections?.();
    await new Promise((r) => this.server.close(r));
  }

  get mcpUrl() {
    return `${this.base}/mcp`;
  }

  private json(
    res: http.ServerResponse,
    status: number,
    body: unknown,
    headers = {},
  ) {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  }

  private async readBody(req: http.IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString();
  }

  issueCode(challenge: string) {
    const code = `code-${++this.counter}`;
    this.codes.set(code, { challenge });
    return code;
  }

  expireAccessTokens() {
    this.validAccess.clear();
  }

  revokeRefreshTokens() {
    this.validRefresh.clear();
  }

  private newTokens() {
    const access = `access-${++this.counter}`;
    const refresh = `refresh-${++this.counter}`;
    this.validAccess.add(access);
    this.validRefresh.add(refresh);
    return {
      access_token: access,
      refresh_token: refresh,
      token_type: "Bearer",
      expires_in: 3600,
    };
  }

  private metadataPath() {
    return (
      this.options.customMetadataPath ?? "/.well-known/oauth-protected-resource"
    );
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = (req.url ?? "").split("?")[0];
    this.requests.push(`${req.method} ${path}`);

    if (
      path === this.metadataPath() ||
      (!this.options.customMetadataPath &&
        path.startsWith("/.well-known/oauth-protected-resource"))
    ) {
      return this.json(res, 200, {
        resource: this.mcpUrl,
        authorization_servers: [this.base],
      });
    }
    if (path.startsWith("/.well-known/oauth-authorization-server")) {
      return this.json(res, 200, {
        issuer: this.base,
        authorization_endpoint: `${this.base}/authorize`,
        token_endpoint: `${this.base}/token`,
        registration_endpoint: `${this.base}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    }
    if (path === "/register" && req.method === "POST") {
      const body = JSON.parse(await this.readBody(req));
      return this.json(res, 201, { ...body, client_id: "mock-client" });
    }
    if (path === "/token" && req.method === "POST") {
      const form = new URLSearchParams(await this.readBody(req));
      const grant = form.get("grant_type") ?? "";
      this.grants.push(grant);
      if (grant === "authorization_code") {
        const entry = this.codes.get(form.get("code") ?? "");
        const verifier = form.get("code_verifier") ?? "";
        const challenge = crypto
          .createHash("sha256")
          .update(verifier)
          .digest("base64url");
        if (!entry || entry.challenge !== challenge) {
          return this.json(res, 400, {
            error: "invalid_grant",
            error_description: "bad code or PKCE verifier",
          });
        }
        this.codes.delete(form.get("code")!);
        return this.json(res, 200, this.newTokens());
      }
      if (grant === "refresh_token") {
        const refresh = form.get("refresh_token") ?? "";
        if (!this.validRefresh.has(refresh)) {
          return this.json(res, 400, {
            error: "invalid_grant",
            error_description: "refresh token revoked",
          });
        }
        this.validRefresh.delete(refresh);
        return this.json(res, 200, this.newTokens());
      }
      return this.json(res, 400, { error: "unsupported_grant_type" });
    }

    if (path === "/mcp") {
      const auth = req.headers.authorization ?? "";
      const token = auth.replace(/^Bearer /i, "");
      if (!this.validAccess.has(token)) {
        req.resume();
        return this.json(
          res,
          401,
          { error: this.options.unauthorizedBody ?? "invalid_token" },
          this.options.challenge
            ? {
                "www-authenticate": `Bearer resource_metadata="${this.base}${this.metadataPath()}"`,
              }
            : {},
        );
      }
      if (req.method === "GET" || req.method === "DELETE") {
        res.writeHead(405);
        return res.end();
      }
      const message = JSON.parse(await this.readBody(req));
      if (message.method === "initialize") {
        return this.json(res, 200, {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: message.params.protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { name: "mock-mcp", version: "1.0.0" },
          },
        });
      }
      if (message.method === "tools/list") {
        return this.json(res, 200, {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            tools: [
              {
                name: "echo",
                description: "Echo",
                inputSchema: { type: "object" },
              },
            ],
          },
        });
      }
      res.writeHead(202);
      return res.end();
    }

    res.writeHead(404);
    res.end();
  }
}

export async function freePort(): Promise<number> {
  return await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

export async function waitFor(
  check: () => boolean | Promise<boolean>,
  what: string,
  ms = 8000,
) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/** Whether the openssl CLI is available (needed for the TLS variants). */
export function hasOpenssl(): boolean {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** A throwaway CA and a localhost server certificate signed by it. */
export function createTestCa() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ca-"));
  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
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
  return {
    caPath: path.join(dir, "ca.pem"),
    caPem: fs.readFileSync(path.join(dir, "ca.pem"), "utf8"),
    tls: {
      key: fs.readFileSync(path.join(dir, "srv.key"), "utf8"),
      cert: fs.readFileSync(path.join(dir, "srv.pem"), "utf8"),
    },
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** A CONNECT proxy that tunnels to `targetPort` on localhost and records targets. */
export async function startConnectProxy(targetPort: number) {
  const connects: string[] = [];
  const sockets = new Set<{ destroy(): unknown }>();
  const proxy = http.createServer();
  proxy.on("connect", (req, clientSocket, head) => {
    connects.push(req.url ?? "");
    sockets.add(clientSocket);
    const upstream = net.connect(targetPort, "127.0.0.1", () => {
      sockets.add(upstream);
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => upstream.destroy());
  });
  await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
    connects,
    close: async () => {
      // CONNECT tunnels are detached from the HTTP server, so close them here
      sockets.forEach((socket) => socket.destroy());
      (proxy as any).closeAllConnections?.();
      await new Promise((r) => proxy.close(r));
    },
  };
}
