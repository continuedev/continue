import fs from "node:fs";
import net from "node:net";
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
import {
  MockOAuthMcpServer,
  MockOptions,
  freePort,
  waitFor,
} from "./mockOAuthMcpServer";
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
