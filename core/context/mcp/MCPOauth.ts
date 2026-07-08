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

// Use a Map to support concurrent authentications for different servers
interface MCPOauthContext {
  serverId: string;
  ide: IDE;
  state?: string;
}
const authenticatingContexts = new Map<string, MCPOauthContext>();

// Map state parameters to server URLs for OAuth callback matching
const stateToServerUrl = new Map<string, string>();

const PORT = 3000;

let serverInstance: http.Server | null = null;

const createServerForOAuth = () =>
  http.createServer((req, res) => {
    try {
      if (!req.url) {
        throw new Error("no url found");
      }

      const parsedUrl = url.parse(req.url, true);
      if (!parsedUrl.query["code"]) {
        throw new Error("no query params found");
      }

      const code = parsedUrl.query["code"] as string;
      const state = parsedUrl.query["state"] as string | undefined;

      void handleMCPOauthCode(code, state);

      const html = `
<!DOCTYPE html>
<html>
<head><title>Authentication Complete</title></head>
<body>Authentication Complete. You can close this page now.</body>
</html>`;

      res.writeHead(200, {
        "Content-Type": "text/html",
      });
      res.end(html);
    } catch (error) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(`Unexpected redirect error:  ${(error as Error).message}`);
    }
  });

type MCPOauthStorage = GlobalContextType["mcpOauthStorage"][string];
type MCPOauthStorageKey = keyof MCPOauthStorage;

class MCPConnectionOauthProvider implements OAuthClientProvider {
  private globalContext: GlobalContext;
  private _redirectUrl: string;
  private _redirectUrlInitialized: Promise<void>;

  constructor(
    public oauthServerUrl: string,
    private ide: IDE,
  ) {
    this.globalContext = new GlobalContext();
    // Set default redirect URL immediately for synchronous access
    this._redirectUrl = `http://localhost:${PORT}`;
    // Initialize actual redirect URL asynchronously
    this._redirectUrlInitialized = this._initializeRedirectUrl();
  }

  private async _initializeRedirectUrl(): Promise<void> {
    try {
      // If IDE supports getExternalUri (VS Code extension), use it for dynamic redirect URI
      if (this.ide.getExternalUri) {
        const localUri = `http://localhost:${PORT}`;
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

  async redirectToAuthorization(authorizationUrl: URL) {
    // Ensure redirect URL is initialized before proceeding
    await this.ensureRedirectUrl();

    // Only create and start local server if using localhost redirect
    // For web-based VS Code, the redirect will be handled by VS Code's built-in mechanism
    if (!this.ide.getExternalUri || this._redirectUrl.includes("localhost")) {
      if (!serverInstance) {
        serverInstance = createServerForOAuth();
      }
      if (!serverInstance.listening) {
        await new Promise<void>((resolve, reject) => {
          serverInstance!.listen(PORT, () => {
            console.debug(
              `Server started for MCP Oauth process at http://localhost:${PORT}/`,
            );
            resolve();
          });
          serverInstance!.on("error", reject);
        });
      }
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
 * checks if the authentication is already done for the current server
 * if not, starts the authentication process by opening a webpage url
 */
export async function performAuth(serverId: string, url: string, ide: IDE) {
  const authProvider = new MCPConnectionOauthProvider(url, ide);
  // Ensure redirect URL is ready before starting auth
  await authProvider.ensureRedirectUrl();

  // Generate a unique state parameter for this auth flow
  const state = uuidv4();

  // Store context for this specific server with state
  authenticatingContexts.set(url, {
    serverId,
    ide,
    state,
  });

  // Map state to server URL for callback matching
  stateToServerUrl.set(state, url);

  try {
    return await auth(authProvider, {
      serverUrl: url,
    });
  } catch (error) {
    // Clean up on error
    authenticatingContexts.delete(url);
    stateToServerUrl.delete(state);
    throw error;
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

  const { ide, serverId } = context;

  try {
    if (!serverUrl) {
      throw new Error("No MCP server url found for authentication");
    }
    if (!authorizationCode) {
      throw new Error(`No MCP authorization code found for ${serverUrl}`);
    }

    // Close the server before processing auth
    if (serverInstance) {
      await new Promise<void>((resolve) => {
        serverInstance!.close(() => {
          console.debug("Server for MCP Oauth process was closed");
          serverInstance = null;
          resolve();
        });
      });
    }

    const authProvider = new MCPConnectionOauthProvider(serverUrl, ide);
    await authProvider.ensureRedirectUrl();
    const authStatus = await auth(authProvider, {
      serverUrl,
      authorizationCode,
    });

    if (authStatus === "AUTHORIZED") {
      const { MCPManagerSingleton } = await import("./MCPManagerSingleton"); // put dynamic import to avoid cyclic imports
      await MCPManagerSingleton.getInstance().refreshConnection(serverId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("OAuth authorization failed:", errorMessage);
    if (context?.ide) {
      await context.ide.showToast("error", `OAuth failed: ${errorMessage}`);
    }
  } finally {
    // Always clean up the context and state mapping
    authenticatingContexts.delete(serverUrl);
    if (state) {
      stateToServerUrl.delete(state);
    }
  }
}

export function removeMCPAuth(url: string, ide: IDE) {
  const authProvider = new MCPConnectionOauthProvider(url, ide);
  authProvider.clear();
}
