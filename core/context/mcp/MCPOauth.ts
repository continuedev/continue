import {
  OAuthClientProvider,
  auth,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthClientInformationFull,
  OAuthClientInformationSchema,
  OAuthTokens,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { IDE } from "../..";

import http from "http";
import url from "url";
import { v4 as uuidv4 } from "uuid";
import { GlobalContext, GlobalContextType } from "../../util/GlobalContext";
import { getTlsErrorHint } from "@continuedev/fetch";
import { probeResourceMetadataUrl } from "./mcpAuthProbe";

export const DEFAULT_OAUTH_CALLBACK_PORT = 3000;

/** How long a sign-in may stay open in the browser before we give up. */
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

type FetchLike = (url: string | URL, init?: any) => Promise<Response>;

export interface McpOauthOptions {
  /** Port of the local redirect server (default 3000). */
  callbackPort?: number;
  /** Fetch used for discovery, registration and token requests. */
  fetchFn?: FetchLike;
}

// Use a Map to support concurrent authentications for different servers
interface MCPOauthContext {
  serverId: string;
  ide: IDE;
  state?: string;
  port: number;
  resourceMetadataUrl?: URL;
  fetchFn?: FetchLike;
  timeout?: ReturnType<typeof setTimeout>;
}
const authenticatingContexts = new Map<string, MCPOauthContext>();

// Map state parameters to server URLs for OAuth callback matching
const stateToServerUrl = new Map<string, string>();

// One local redirect server per port, so servers can use different ports
const callbackServers = new Map<number, http.Server>();

export function getOauthCallbackUrl(port = DEFAULT_OAUTH_CALLBACK_PORT) {
  return `http://localhost:${port}`;
}

function html(message: string) {
  return `
<!DOCTYPE html>
<html>
<head><title>Authentication</title></head>
<body>${message}</body>
</html>`;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const createServerForOAuth = (port: number) =>
  http.createServer((req, res) => {
    try {
      if (!req.url) {
        throw new Error("no url found");
      }

      const parsedUrl = url.parse(req.url, true);
      const state = parsedUrl.query["state"] as string | undefined;

      // The authorization server can redirect back with an error instead of a code
      const oauthError = parsedUrl.query["error"] as string | undefined;
      if (oauthError) {
        const description =
          (parsedUrl.query["error_description"] as string | undefined) ??
          oauthError;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          html(
            `Sign-in was not completed (${escapeHtml(description)}). You can close this page.`,
          ),
        );
        // Only tear things down once the page has been delivered
        res.once("finish", () => {
          void handleMCPOauthFailure(
            `Sign-in was not completed: ${description}`,
            state,
            port,
          );
        });
        return;
      }

      if (!parsedUrl.query["code"]) {
        throw new Error("no query params found");
      }

      const code = parsedUrl.query["code"] as string;

      res.writeHead(200, {
        "Content-Type": "text/html",
      });
      res.end(html("Authentication Complete. You can close this page now."));
      // The code exchange closes this server, so wait until the page is sent
      res.once("finish", () => {
        void handleMCPOauthCode(code, state);
      });
    } catch (error) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(`Unexpected redirect error:  ${(error as Error).message}`);
    }
  });

async function startCallbackServer(port: number): Promise<void> {
  let server = callbackServers.get(port);
  if (!server) {
    server = createServerForOAuth(port);
    callbackServers.set(port, server);
  }
  if (server.listening) {
    return;
  }
  const instance = server;
  await new Promise<void>((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      callbackServers.delete(port);
      reject(
        err.code === "EADDRINUSE"
          ? new Error(
              `The OAuth callback port ${port} is already in use. Close the program using it, or choose another port with \`oauth.callbackPort\` on this MCP server.`,
            )
          : err,
      );
    };
    instance.once("error", onError);
    instance.listen(port, () => {
      instance.off("error", onError);
      console.debug(
        `Server started for MCP Oauth process at http://localhost:${port}/`,
      );
      resolve();
    });
  });
}

async function stopCallbackServer(port: number): Promise<void> {
  const server = callbackServers.get(port);
  if (!server) return;
  callbackServers.delete(port);
  await new Promise<void>((resolve) => {
    server.close(() => {
      console.debug("Server for MCP Oauth process was closed");
      resolve();
    });
    // Don't wait on idle keep-alive connections from the browser
    (server as any).closeIdleConnections?.();
  });
}

type MCPOauthStorage = GlobalContextType["mcpOauthStorage"][string];
type MCPOauthStorageKey = keyof MCPOauthStorage;

export class MCPConnectionOauthProvider implements OAuthClientProvider {
  private globalContext: GlobalContext;
  private _redirectUrl: string;
  private _redirectUrlInitialized: Promise<void>;
  private port: number;

  /**
   * @param interactive false for connect-time use: stored tokens are used and
   *   refreshed, but the browser is never opened. Sign-in is an explicit action.
   */
  constructor(
    public oauthServerUrl: string,
    private ide: IDE,
    private options: McpOauthOptions & { interactive?: boolean } = {},
  ) {
    this.globalContext = new GlobalContext();
    this.port = options.callbackPort ?? DEFAULT_OAUTH_CALLBACK_PORT;
    // Set default redirect URL immediately for synchronous access
    this._redirectUrl = getOauthCallbackUrl(this.port);
    // Initialize actual redirect URL asynchronously
    this._redirectUrlInitialized = this._initializeRedirectUrl();
  }

  private async _initializeRedirectUrl(): Promise<void> {
    try {
      // If IDE supports getExternalUri (VS Code extension), use it for dynamic redirect URI
      if (this.ide.getExternalUri) {
        const localUri = getOauthCallbackUrl(this.port);
        const externalUri = await this.ide.getExternalUri(localUri);
        this._redirectUrl = externalUri;
      }
      // Otherwise keep the default localhost URL
    } catch (error) {
      console.error("Failed to initialize redirect URL:", error);
      // Keep default URL on error
    }
  }

  get redirectUrl() {
    // Always return a valid URL, even if initialization is pending
    return this._redirectUrl;
  }

  getRedirectUrlWithState(state: string): string {
    // Add state parameter to redirect URL
    const urlObj = new URL(this._redirectUrl);
    urlObj.searchParams.set("state", state);
    return urlObj.toString();
  }

  async ensureRedirectUrl(): Promise<string> {
    // Wait for initialization to complete before returning
    await this._redirectUrlInitialized;
    return this._redirectUrl;
  }

  get clientMetadata() {
    // Generate state parameter if needed
    const state = authenticatingContexts.get(this.oauthServerUrl)?.state;
    const redirectUri = state
      ? this.getRedirectUrlWithState(state)
      : this.redirectUrl;

    return {
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: "Continue Dev, Inc", // get this from package.json?
      client_uri: "https://continue.dev", // get this from package.json?
    };
  }

  private _getOauthStorage<K extends MCPOauthStorageKey>(key: K) {
    return this.globalContext.get("mcpOauthStorage")?.[this.oauthServerUrl]?.[
      key
    ];
  }

  private _updateOauthStorage<K extends MCPOauthStorageKey>(
    key: K,
    value: MCPOauthStorage[K],
  ) {
    const existingStorage = this.globalContext.get("mcpOauthStorage") ?? {};
    const existingServerStorage = existingStorage[this.oauthServerUrl] ?? {};

    this.globalContext.update("mcpOauthStorage", {
      ...existingStorage,
      [this.oauthServerUrl]: {
        ...existingServerStorage,
        [key]: value,
      },
    });
  }

  private _clearOauthStorage() {
    const existingStorage = this.globalContext.get("mcpOauthStorage") ?? {};
    delete existingStorage[this.oauthServerUrl];
    this.globalContext.update("mcpOauthStorage", existingStorage);
  }

  saveClientInformation(clientInformation: OAuthClientInformationFull) {
    this._updateOauthStorage("clientInformation", clientInformation);
  }

  async clientInformation() {
    const existingClientInformation =
      this._getOauthStorage("clientInformation");
    if (!existingClientInformation) {
      return undefined;
    }
    return await OAuthClientInformationSchema.parseAsync(
      existingClientInformation,
    );
  }

  async tokens() {
    const existingTokens = this._getOauthStorage("tokens");
    if (!existingTokens) {
      return undefined;
    }
    return await OAuthTokensSchema.parseAsync(existingTokens);
  }

  saveTokens(tokens: OAuthTokens) {
    this._updateOauthStorage("tokens", tokens);
  }

  codeVerifier(): string | Promise<string> {
    const existingCodeVerifier = this._getOauthStorage("codeVerifier");
    if (!existingCodeVerifier) {
      return "";
    }
    return existingCodeVerifier;
  }

  saveCodeVerifier(codeVerifier: string) {
    this._updateOauthStorage("codeVerifier", codeVerifier);
  }

  clear() {
    this._clearOauthStorage();
  }

  /**
   * Called by the SDK when the server rejects our credentials for good (for
   * example a revoked refresh token): drop what is stale instead of retrying
   * with it forever.
   */
  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier") {
    if (scope === "all") {
      this._clearOauthStorage();
      return;
    }
    const existing = this.globalContext.get("mcpOauthStorage") ?? {};
    const server = { ...(existing[this.oauthServerUrl] ?? {}) };
    if (scope === "client") delete server.clientInformation;
    if (scope === "tokens") delete server.tokens;
    if (scope === "verifier") delete server.codeVerifier;
    this.globalContext.update("mcpOauthStorage", {
      ...existing,
      [this.oauthServerUrl]: server,
    });
  }

  async redirectToAuthorization(authorizationUrl: URL) {
    if (this.options.interactive === false) {
      // Connect-time: the SDK wants the user to sign in. Don't open a browser
      // uninvited; the connection reports "sign-in required" instead.
      return;
    }

    // Ensure redirect URL is initialized before proceeding
    await this.ensureRedirectUrl();

    // Only create and start local server if using localhost redirect
    // For web-based VS Code, the redirect will be handled by VS Code's built-in mechanism
    if (!this.ide.getExternalUri || this._redirectUrl.includes("localhost")) {
      await startCallbackServer(this.port);
    }
    await this.ide.openUrl(authorizationUrl.toString());
  }
}

export async function getOauthToken(mcpServerUrl: string, ide: IDE) {
  const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  const tokens = await authProvider.tokens();
  return tokens?.access_token;
}

/**
 * Provider for use as a transport's `authProvider`, or undefined when the user
 * has not signed in to this server. With stored tokens the SDK sends the bearer
 * token, refreshes it when it expires, and saves the new one through
 * `saveTokens()`; it never opens a browser from here.
 */
export async function createSignedInOauthProvider(
  mcpServerUrl: string,
  ide: IDE,
  options: McpOauthOptions = {},
): Promise<MCPConnectionOauthProvider | undefined> {
  const provider = new MCPConnectionOauthProvider(mcpServerUrl, ide, {
    ...options,
    interactive: false,
  });
  return (await provider.tokens()) ? provider : undefined;
}

/** Whether tokens are stored for this server (drives the Sign out action). */
export async function hasStoredOauth(
  mcpServerUrl: string,
  ide: IDE,
): Promise<boolean> {
  const provider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  return !!(await provider.tokens());
}

function endAuthFlow(serverUrl: string, state?: string) {
  const context = authenticatingContexts.get(serverUrl);
  if (context?.timeout) clearTimeout(context.timeout);
  authenticatingContexts.delete(serverUrl);
  if (state) {
    stateToServerUrl.delete(state);
  }
}

/** Is another sign-in still waiting on this port? */
function portInUseByAnotherFlow(port: number, exceptUrl?: string) {
  return Array.from(authenticatingContexts.entries()).some(
    ([u, c]) => c.port === port && u !== exceptUrl,
  );
}

/**
 * checks if the authentication is already done for the current server
 * if not, starts the authentication process by opening a webpage url
 */
export async function performAuth(
  serverId: string,
  url: string,
  ide: IDE,
  options: McpOauthOptions = {},
) {
  const port = options.callbackPort ?? DEFAULT_OAUTH_CALLBACK_PORT;
  const authProvider = new MCPConnectionOauthProvider(url, ide, {
    ...options,
    interactive: true,
  });
  // Ensure redirect URL is ready before starting auth
  await authProvider.ensureRedirectUrl();

  // Generate a unique state parameter for this auth flow
  const state = uuidv4();

  // Some servers (e.g. Atlassian) only advertise their OAuth metadata in the
  // 401 challenge, so read it instead of guessing from the server URL.
  const resourceMetadataUrl = await probeResourceMetadataUrl(
    url,
    options.fetchFn as any,
  );

  // Store context for this specific server with state
  authenticatingContexts.set(url, {
    serverId,
    ide,
    state,
    port,
    resourceMetadataUrl,
    fetchFn: options.fetchFn,
  });

  // Map state to server URL for callback matching
  stateToServerUrl.set(state, url);

  try {
    const result = await auth(authProvider, {
      serverUrl: url,
      resourceMetadataUrl,
      fetchFn: options.fetchFn as any,
    });
    if (result === "REDIRECT") {
      // Give up on a sign-in that is never completed in the browser
      const context = authenticatingContexts.get(url);
      if (context) {
        context.timeout = setTimeout(() => {
          void handleMCPOauthFailure(
            "Sign-in timed out. Try again.",
            state,
            port,
          );
        }, SIGN_IN_TIMEOUT_MS);
        context.timeout.unref?.();
      }
    }
    return result;
  } catch (error) {
    // Clean up on error, including stale registration / verifier state that
    // would otherwise make the next attempt fail the same way
    endAuthFlow(url, state);
    authProvider.clear();
    if (!portInUseByAnotherFlow(port)) {
      await stopCallbackServer(port);
    }
    // An untrusted certificate or proxy problem is the usual cause behind
    // "fetch failed" here; say how to fix it.
    const tlsHint = getTlsErrorHint(error);
    if (error instanceof Error && tlsHint && !error.message.includes(tlsHint)) {
      error.message = `${error.message}\n\n${tlsHint}`;
    }
    throw error;
  }
}

/**
 * Report a failed or abandoned sign-in: clear what it left behind, free the
 * callback port and tell the user.
 */
async function handleMCPOauthFailure(
  message: string,
  state: string | undefined,
  port: number,
) {
  let serverUrl = state ? stateToServerUrl.get(state) : undefined;
  if (!serverUrl) {
    // Servers/SDKs that send no `state` (the SDK only does when the provider
    // defines one): fall back to the only sign-in waiting on this port.
    const onPort = Array.from(authenticatingContexts.entries()).filter(
      ([, c]) => c.port === port,
    );
    if (onPort.length === 1) {
      serverUrl = onPort[0][0];
    }
  }
  const context = serverUrl ? authenticatingContexts.get(serverUrl) : undefined;
  state = state ?? context?.state;

  if (serverUrl) {
    endAuthFlow(serverUrl, state);
    new MCPConnectionOauthProvider(
      serverUrl,
      context?.ide ?? ({} as IDE),
    ).clear();
  }
  if (!portInUseByAnotherFlow(port)) {
    await stopCallbackServer(port);
  }
  if (context?.ide) {
    await context.ide.showToast("error", message);
    try {
      const { MCPManagerSingleton } = await import("./MCPManagerSingleton");
      MCPManagerSingleton.getInstance().setStatus(context.serverId, "error");
    } catch {
      // The server may have been removed in the meantime
    }
  }
}

/**
 * handle the authentication code received from the oauth redirect
 */
async function handleMCPOauthCode(authorizationCode: string, state?: string) {
  let serverUrl: string | undefined;
  let context: MCPOauthContext | undefined;

  if (state) {
    // Use state parameter to find the correct server
    serverUrl = stateToServerUrl.get(state);
    if (serverUrl) {
      context = authenticatingContexts.get(serverUrl);
    }
  } else {
    // Fallback: if no state or single context, use the first one
    const contexts = Array.from(authenticatingContexts.entries());
    if (contexts.length === 1) {
      [serverUrl, context] = contexts[0];
    }
  }

  if (!context || !serverUrl) {
    console.error("No matching authenticating context found for state:", state);
    return;
  }

  const { ide, serverId, port } = context;
  if (context.timeout) clearTimeout(context.timeout);

  try {
    if (!serverUrl) {
      throw new Error("No MCP server url found for authentication");
    }
    if (!authorizationCode) {
      throw new Error(`No MCP authorization code found for ${serverUrl}`);
    }

    // Close the server before processing auth, unless another sign-in is
    // still waiting on the same port
    if (!portInUseByAnotherFlow(port, serverUrl)) {
      await stopCallbackServer(port);
    }

    const authProvider = new MCPConnectionOauthProvider(serverUrl, ide, {
      callbackPort: port,
      interactive: true,
    });
    await authProvider.ensureRedirectUrl();
    const authStatus = await auth(authProvider, {
      serverUrl,
      authorizationCode,
      resourceMetadataUrl: context.resourceMetadataUrl,
      fetchFn: context.fetchFn as any,
    });

    if (authStatus === "AUTHORIZED") {
      const { MCPManagerSingleton } = await import("./MCPManagerSingleton"); // put dynamic import to avoid cyclic imports
      await MCPManagerSingleton.getInstance().refreshConnection(serverId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("OAuth authorization failed:", errorMessage);
    // Don't keep a half-finished registration / verifier around
    new MCPConnectionOauthProvider(serverUrl, ide).clear();
    if (context?.ide) {
      await context.ide.showToast("error", `OAuth failed: ${errorMessage}`);
      try {
        const { MCPManagerSingleton } = await import("./MCPManagerSingleton");
        MCPManagerSingleton.getInstance().setStatus(serverId, "error");
      } catch {
        // ignore
      }
    }
  } finally {
    // Always clean up the context and state mapping
    endAuthFlow(serverUrl, state);
  }
}

export function removeMCPAuth(url: string, ide: IDE) {
  const authProvider = new MCPConnectionOauthProvider(url, ide);
  authProvider.clear();
}
