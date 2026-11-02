import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net, { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { IDE } from "../..";
import { GlobalContext } from "../../util/GlobalContext";
import { getGlobalContextFilePath } from "../../util/paths";
import { MCPManagerSingleton } from "./MCPManagerSingleton";
import { performAuth } from "./MCPOauth";

// core's Vitest setup replaces the global fetch / Request / Response with
// node-fetch's, but the MCP SDK relies on the native ones (response.body.cancel,
// `instanceof Response` when parsing OAuth errors), and so does the extension
// host. Capture the natives now (module load happens before the setup's
// beforeAll hooks) and put them back for this file only.
const nativeGlobals = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
};
let setupGlobals: typeof nativeGlobals;
beforeAll(() => {
  setupGlobals = {
    fetch: globalThis.fetch,
    Request: globalThis.Request,
    Response: globalThis.Response,
  };
  Object.assign(globalThis, nativeGlobals);
});
afterAll(() => {
  Object.assign(globalThis, setupGlobals);
});

/**
 * End-to-end OAuth for remote MCP servers: the real MCPConnection and sign-in
 * code against a mock MCP server that demands a bearer token and a mock OAuth
 * authorization server (dynamic client registration, PKCE, refresh tokens).
 */

interface MockOptions {
  /** Send a WWW-Authenticate challenge pointing at the metadata URL. */
  challenge?: boolean;
  /** Serve OAuth metadata at a non-standard path (only the challenge reveals it). */
  customMetadataPath?: string;
  /** Body of the 401 response; real servers rarely say "401" or "Unauthorized". */
  unauthorizedBody?: string;
}

class MockOAuthMcpServer {
  server!: http.Server;
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
    this.server = http.createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.port = (this.server.address() as AddressInfo).port;
    this.base = `http://127.0.0.1:${this.port}`;
  }

  async stop() {
    this.server.closeAllConnections?.();
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

async function freePort(): Promise<number> {
  return await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(
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

describe("MCP OAuth end to end", { timeout: 20_000 }, () => {
  let mock: MockOAuthMcpServer;
  let ide: {
    openUrl: ReturnType<typeof vi.fn>;
    showToast: ReturnType<typeof vi.fn>;
  };
  let callbackPort: number;
  let globalContextFile: string;
  const serverId = "mock";

  const options = () =>
    ({
      id: serverId,
      name: serverId,
      type: "streamable-http" as const,
      url: mock.mcpUrl,
      oauth: { callbackPort },
    }) as any;

  const connection = () =>
    MCPManagerSingleton.getInstance().getConnection(serverId)!;
  const storedTokens = () =>
    new GlobalContext().get("mcpOauthStorage")?.[mock.mcpUrl]?.tokens;

  async function startServer(opts?: MockOptions) {
    mock = new MockOAuthMcpServer(opts);
    await mock.start();
    // setConnections starts the first connection attempt itself
    MCPManagerSingleton.getInstance().setConnections([options()], true, {
      ide: ide as unknown as IDE,
    });
    await waitFor(
      () => ["error", "connected"].includes(connection().status),
      "the first connection attempt",
    );
  }

  /** Sign in the way the UI does: open the browser, then complete the redirect. */
  async function signIn() {
    const result = await performAuth(
      serverId,
      mock.mcpUrl,
      ide as unknown as IDE,
      {
        callbackPort,
      },
    );
    expect(result).toBe("REDIRECT");
    const authorizeUrl = new URL(ide.openUrl.mock.calls.at(-1)![0]);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      `${mock.base}/authorize`,
    );
    const state = authorizeUrl.searchParams.get("state");
    const code = mock.issueCode(
      authorizeUrl.searchParams.get("code_challenge")!,
    );
    const redirect = `${authorizeUrl.searchParams.get("redirect_uri")}`;
    const callback = new URL(redirect);
    callback.searchParams.set("code", code);
    if (state) callback.searchParams.set("state", state);
    const resp = await fetch(callback);
    expect(resp.status).toBe(200);
    await waitFor(
      () => connection().status === "connected",
      "connection after sign-in",
    ).catch((e) => {
      throw new Error(
        `${e.message}; status=${connection().status} errors=${JSON.stringify(connection().getStatus().errors)} toasts=${JSON.stringify(ide.showToast.mock.calls)} requests=${mock.requests.join(" | ")}`,
      );
    });
  }

  beforeEach(async () => {
    globalContextFile = getGlobalContextFilePath();
    if (fs.existsSync(globalContextFile)) fs.unlinkSync(globalContextFile);
    ide = { openUrl: vi.fn(async () => {}), showToast: vi.fn(async () => {}) };
    callbackPort = await freePort();
  });

  afterEach(async () => {
    await MCPManagerSingleton.getInstance().shutdown();
    await mock?.stop();
    if (fs.existsSync(globalContextFile)) fs.unlinkSync(globalContextFile);
  });

  test("a 401 with an opaque body (no '401', no 'Unauthorized') still means sign-in is needed", async () => {
    await startServer({ unauthorizedBody: "invalid_token" });
    expect(connection().status).toBe("error");
    expect(connection().isProtectedResource).toBe(true);
    const infos = connection().getStatus().infos.join("\n");
    expect(infos).toContain("requires sign-in");
    expect(infos).toContain(`http://localhost:${callbackPort}`);
  });

  test("connecting never opens a browser on its own", async () => {
    await startServer();
    expect(ide.openUrl).not.toHaveBeenCalled();
    expect(mock.requests.some((r) => r.includes("/authorize"))).toBe(false);
    expect(mock.grants).toEqual([]);
  });

  test("sign in over streamable-http connects and lists tools, then the token is reused", async () => {
    await startServer();
    await signIn();
    expect(connection().tools.map((t) => t.name)).toEqual(["echo"]);
    expect(storedTokens()?.access_token).toBeTruthy();
    expect(mock.grants).toEqual(["authorization_code"]);

    // A later connection (e.g. after restarting the editor) needs no sign-in
    const before = mock.grants.length;
    await MCPManagerSingleton.getInstance().refreshConnection(serverId);
    expect(connection().status).toBe("connected");
    expect(mock.grants.length).toBe(before);
    expect(ide.openUrl).toHaveBeenCalledTimes(1);
  });

  test("an expired access token is refreshed silently and the new token is saved", async () => {
    await startServer();
    await signIn();
    const firstAccess = storedTokens()!.access_token;

    mock.expireAccessTokens();
    await MCPManagerSingleton.getInstance().refreshConnection(serverId);

    expect(connection().status).toBe("connected");
    expect(mock.grants).toEqual(["authorization_code", "refresh_token"]);
    expect(storedTokens()!.access_token).not.toBe(firstAccess);
    expect(ide.openUrl).toHaveBeenCalledTimes(1); // no second browser window
  });

  test("a revoked refresh token gives a clear 'sign in again' state and no stale tokens", async () => {
    await startServer();
    await signIn();

    mock.expireAccessTokens();
    mock.revokeRefreshTokens();
    await MCPManagerSingleton.getInstance().refreshConnection(serverId);

    expect(connection().status).toBe("error");
    expect(connection().isProtectedResource).toBe(true);
    expect(storedTokens()).toBeUndefined();
    expect(connection().getStatus().infos.join("\n")).toMatch(
      /sign in|requires sign-in/i,
    );
    expect(ide.openUrl).toHaveBeenCalledTimes(1); // still no uninvited browser

    // and it does not loop: reconnecting makes no further refresh attempts
    const refreshes = mock.grants.filter((g) => g === "refresh_token").length;
    await MCPManagerSingleton.getInstance().refreshConnection(serverId);
    expect(mock.grants.filter((g) => g === "refresh_token").length).toBe(
      refreshes,
    );
  });

  test("sign-in works when the OAuth metadata is only advertised in the 401 challenge", async () => {
    await startServer({
      challenge: true,
      customMetadataPath: "/custom/protected-resource-metadata",
    });
    await signIn();
    expect(connection().status).toBe("connected");
  });

  test("a busy callback port fails with a message that names the port", async () => {
    await startServer();
    const blocker = net.createServer();
    await new Promise<void>((r) => blocker.listen(callbackPort, r));
    try {
      await expect(
        performAuth(serverId, mock.mcpUrl, ide as unknown as IDE, {
          callbackPort,
        }),
      ).rejects.toThrow(new RegExp(`port ${callbackPort}.*already in use`));
    } finally {
      await new Promise((r) => blocker.close(r));
    }
    // nothing half-finished is left behind
    expect(
      new GlobalContext().get("mcpOauthStorage")?.[mock.mcpUrl],
    ).toBeUndefined();
  });

  test("a denied sign-in is reported and cleaned up", async () => {
    await startServer();
    await performAuth(serverId, mock.mcpUrl, ide as unknown as IDE, {
      callbackPort,
    });
    const authorizeUrl = new URL(ide.openUrl.mock.calls.at(-1)![0]);
    const callback = new URL(authorizeUrl.searchParams.get("redirect_uri")!);
    callback.searchParams.set("error", "access_denied");
    callback.searchParams.set("error_description", "User said no");
    const state = authorizeUrl.searchParams.get("state");
    if (state) callback.searchParams.set("state", state);
    await fetch(callback);

    await waitFor(() => ide.showToast.mock.calls.length > 0, "an error toast");
    expect(ide.showToast.mock.calls[0][1]).toContain("User said no");
    expect(connection().status).toBe("error");
    expect(
      new GlobalContext().get("mcpOauthStorage")?.[mock.mcpUrl],
    ).toBeUndefined();

    // the port is free again for the next attempt
    const probe = net.createServer();
    await new Promise<void>((r, j) =>
      probe.once("error", j).listen(callbackPort, r),
    );
    await new Promise((r) => probe.close(r));
  });

  test("a failed code exchange clears the stale registration so a retry starts clean", async () => {
    await startServer();
    await performAuth(serverId, mock.mcpUrl, ide as unknown as IDE, {
      callbackPort,
    });
    const authorizeUrl = new URL(ide.openUrl.mock.calls.at(-1)![0]);
    const callback = new URL(authorizeUrl.searchParams.get("redirect_uri")!);
    callback.searchParams.set("code", "not-a-real-code");
    const state = authorizeUrl.searchParams.get("state");
    if (state) callback.searchParams.set("state", state);
    await fetch(callback);

    await waitFor(() => ide.showToast.mock.calls.length > 0, "an error toast");
    expect(ide.showToast.mock.calls[0][1]).toMatch(/OAuth failed/);
    expect(
      new GlobalContext().get("mcpOauthStorage")?.[mock.mcpUrl],
    ).toBeUndefined();

    // a fresh attempt succeeds
    ide.showToast.mockClear();
    await signIn();
    expect(connection().status).toBe("connected");
  });
});
