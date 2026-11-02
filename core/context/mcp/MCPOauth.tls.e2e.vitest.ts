import fs from "node:fs";
import tls from "node:tls";
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
import { CertsCache } from "@continuedev/fetch";
import { IDE } from "../..";
import { GlobalContext } from "../../util/GlobalContext";
import { getGlobalContextFilePath } from "../../util/paths";
import { MCPManagerSingleton } from "./MCPManagerSingleton";
import { performAuth } from "./MCPOauth";
import {
  MockOAuthMcpServer,
  createTestCa,
  freePort,
  hasOpenssl,
  startConnectProxy,
  waitFor,
} from "./mockOAuthMcpServer";

/**
 * The OAuth flow against an HTTPS MCP server whose certificate is signed by a
 * private CA (what a TLS-inspecting corporate proxy looks like): connecting,
 * sign-in (discovery, registration, token exchange) and token refresh must all
 * honour the server's `requestOptions`.
 */

// core's Vitest setup swaps the global fetch/Request/Response for node-fetch's;
// the MCP SDK needs the native ones (see MCPOauth.e2e.vitest.ts).
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

const PROXY_ENV = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "NO_PROXY",
  "no_proxy",
  "NODE_EXTRA_CA_CERTS",
];

describe.skipIf(!hasOpenssl())(
  "MCP over TLS with a private CA",
  { timeout: 20_000 },
  () => {
    let ca: ReturnType<typeof createTestCa>;
    let mock: MockOAuthMcpServer;
    let proxy: Awaited<ReturnType<typeof startConnectProxy>> | undefined;
    let ide: {
      openUrl: ReturnType<typeof vi.fn>;
      showToast: ReturnType<typeof vi.fn>;
    };
    let callbackPort: number;
    let globalContextFile: string;
    let savedEnv: Record<string, string | undefined> = {};
    const serverId = "tls-mock";

    beforeAll(() => {
      ca = createTestCa();
    });
    afterAll(() => ca.cleanup());

    const connection = () =>
      MCPManagerSingleton.getInstance().getConnection(serverId)!;
    const storedTokens = () =>
      new GlobalContext().get("mcpOauthStorage")?.[mock.mcpUrl]?.tokens;

    async function start(requestOptions?: Record<string, unknown>) {
      mock = new MockOAuthMcpServer({ tls: ca.tls });
      await mock.start();
      MCPManagerSingleton.getInstance().setConnections(
        [
          {
            id: serverId,
            name: serverId,
            type: "streamable-http",
            url: mock.mcpUrl,
            oauth: { callbackPort },
            requestOptions,
          } as any,
        ],
        true,
        { ide: ide as unknown as IDE },
      );
      await waitFor(
        () => ["error", "connected"].includes(connection().status),
        "the first connection attempt",
      );
    }

    /** Sign in the way core.ts does: with the connection's own fetch. */
    async function signIn() {
      await performAuth(serverId, mock.mcpUrl, ide as unknown as IDE, {
        callbackPort,
        fetchFn: connection().getFetch() as any,
      });
      const authorizeUrl = new URL(ide.openUrl.mock.calls.at(-1)![0]);
      const callback = new URL(authorizeUrl.searchParams.get("redirect_uri")!);
      callback.searchParams.set(
        "code",
        mock.issueCode(authorizeUrl.searchParams.get("code_challenge")!),
      );
      const state = authorizeUrl.searchParams.get("state");
      if (state) callback.searchParams.set("state", state);
      expect((await fetch(callback)).status).toBe(200);
      await waitFor(
        () => connection().status === "connected",
        "connection after sign-in",
      );
    }

    beforeEach(async () => {
      globalContextFile = getGlobalContextFilePath();
      if (fs.existsSync(globalContextFile)) fs.unlinkSync(globalContextFile);
      ide = {
        openUrl: vi.fn(async () => {}),
        showToast: vi.fn(async () => {}),
      };
      callbackPort = await freePort();
      proxy = undefined;
      savedEnv = {};
      for (const k of PROXY_ENV) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }
      CertsCache.getInstance().clear();
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await MCPManagerSingleton.getInstance().shutdown();
      await proxy?.close();
      await mock?.stop();
      for (const k of PROXY_ENV) {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
      }
      if (fs.existsSync(globalContextFile)) fs.unlinkSync(globalContextFile);
    });

    test("an untrusted CA fails with a hint, and is not mistaken for 'sign-in needed'", async () => {
      await start({ useSystemCa: false });
      expect(connection().status).toBe("error");
      expect(connection().isProtectedResource).toBe(false);
      const errors = connection().getStatus().errors.join("\n");
      expect(errors).toMatch(/certificate/i);
      expect(errors).toContain("useSystemCa");
      expect(errors).toContain("caBundlePath");
    });

    test("sign-in against an untrusted CA fails with the same hint and cleans up", async () => {
      await start({ useSystemCa: false });
      await expect(
        performAuth(serverId, mock.mcpUrl, ide as unknown as IDE, {
          callbackPort,
          fetchFn: connection().getFetch() as any,
        }),
      ).rejects.toThrow(/caBundlePath/);
      expect(
        new GlobalContext().get("mcpOauthStorage")?.[mock.mcpUrl],
      ).toBeUndefined();
    });

    test("caBundlePath: connect, sign in and use the token", async () => {
      await start({ caBundlePath: ca.caPath });
      expect(connection().status).toBe("error");
      expect(connection().isProtectedResource).toBe(true); // reached the server: 401
      await signIn();
      expect(connection().tools.map((t) => t.name)).toEqual(["echo"]);
      expect(storedTokens()?.access_token).toBeTruthy();
    });

    test("an expired token is refreshed over TLS", async () => {
      await start({ caBundlePath: ca.caPath });
      await signIn();
      mock.expireAccessTokens();
      await MCPManagerSingleton.getInstance().refreshConnection(serverId);
      expect(connection().status).toBe("connected");
      expect(mock.grants).toEqual(["authorization_code", "refresh_token"]);
    });

    test("useSystemCa: trusts a CA that only the OS store knows", async () => {
      vi.spyOn(tls as any, "getCACertificates").mockReturnValue([ca.caPem]);
      await start({ useSystemCa: true });
      expect(connection().isProtectedResource).toBe(true);
      await signIn();
      expect(connection().status).toBe("connected");
    });

    test("verifySsl: false (previously a no-op) now works", async () => {
      await start({ verifySsl: false });
      await signIn();
      expect(connection().status).toBe("connected");
    });

    test("through a proxy, with the CA applied to the origin", async () => {
      mock = new MockOAuthMcpServer({ tls: ca.tls });
      await mock.start();
      proxy = await startConnectProxy(mock.port);
      MCPManagerSingleton.getInstance().setConnections(
        [
          {
            id: serverId,
            name: serverId,
            type: "streamable-http",
            url: mock.mcpUrl,
            oauth: { callbackPort },
            requestOptions: { caBundlePath: ca.caPath, proxy: proxy.url },
          } as any,
        ],
        true,
        { ide: ide as unknown as IDE },
      );
      await waitFor(
        () => ["error", "connected"].includes(connection().status),
        "the first connection attempt",
      );
      await signIn();
      expect(connection().status).toBe("connected");
      expect(proxy.connects.length).toBeGreaterThan(0);
      expect(new Set(proxy.connects)).toEqual(
        new Set([`127.0.0.1:${mock.port}`]),
      );
    });

    test("a proxy from the environment is used too", async () => {
      mock = new MockOAuthMcpServer({ tls: ca.tls });
      await mock.start();
      proxy = await startConnectProxy(mock.port);
      process.env.HTTPS_PROXY = proxy.url;
      MCPManagerSingleton.getInstance().setConnections(
        [
          {
            id: serverId,
            name: serverId,
            type: "streamable-http",
            url: mock.mcpUrl,
            oauth: { callbackPort },
            requestOptions: { caBundlePath: ca.caPath },
          } as any,
        ],
        true,
        { ide: ide as unknown as IDE },
      );
      await waitFor(
        () => ["error", "connected"].includes(connection().status),
        "the first connection attempt",
      );
      expect(proxy.connects.length).toBeGreaterThan(0);
    });

    test("noProxy bypasses the proxy", async () => {
      mock = new MockOAuthMcpServer({ tls: ca.tls });
      await mock.start();
      proxy = await startConnectProxy(mock.port);
      MCPManagerSingleton.getInstance().setConnections(
        [
          {
            id: serverId,
            name: serverId,
            type: "streamable-http",
            url: mock.mcpUrl,
            oauth: { callbackPort },
            requestOptions: {
              caBundlePath: ca.caPath,
              proxy: proxy.url,
              noProxy: ["127.0.0.1"],
            },
          } as any,
        ],
        true,
        { ide: ide as unknown as IDE },
      );
      await waitFor(
        () => ["error", "connected"].includes(connection().status),
        "the first connection attempt",
      );
      expect(connection().isProtectedResource).toBe(true);
      expect(proxy.connects).toEqual([]);
    });

    test("SSE servers get the same treatment", async () => {
      mock = new MockOAuthMcpServer({ tls: ca.tls });
      await mock.start();
      MCPManagerSingleton.getInstance().setConnections(
        [
          {
            id: serverId,
            name: serverId,
            type: "sse",
            url: mock.mcpUrl,
            oauth: { callbackPort },
            requestOptions: { caBundlePath: ca.caPath },
          } as any,
        ],
        true,
        { ide: ide as unknown as IDE },
      );
      await waitFor(
        () => ["error", "connected"].includes(connection().status),
        "the first connection attempt",
      );
      // The mock only speaks streamable-http, but the 401 must be reached
      // (i.e. TLS worked) rather than failing on the certificate.
      expect(connection().getStatus().errors.join("\n")).not.toMatch(
        /certificate/i,
      );
      expect(connection().isProtectedResource).toBe(true);
    });
  },
);
