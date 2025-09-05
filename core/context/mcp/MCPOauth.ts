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
import { IDE, MCPServerStatus, SSEOptions } from "../..";

import http from "http";
import url from "url";
import { GlobalContext, GlobalContextType } from "../../util/GlobalContext";

let authenticatingMCPContext = null as {
  authenticatingServer: MCPServerStatus;
  ide: IDE;
} | null;

const PORT = 3000;

const server = http.createServer((req, res) => {
  try {
    if (!req.url) {
      throw new Error("no url found");
    }

    const parsedUrl = url.parse(req.url, true);
    if (!parsedUrl.query["code"]) {
      throw new Error("no query params found");
    }

    void handleMCPOauthCode(parsedUrl.query["code"] as string);

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

  constructor(
    public oauthServerUrl: string,
    private ide: IDE,
  ) {
    this.globalContext = new GlobalContext();
  }

  get redirectUrl() {
    return `http://localhost:${PORT}`; // TODO: this has to be a hub url or should we spin up a server?
  }

  get clientMetadata() {
    return {
      redirect_uris: [this.redirectUrl],
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
    if (!server.listening) {
      server.listen(PORT, () => {
        console.debug(
          `Server started for MCP Oauth process at http://localhost:${PORT}/`,
        );
      });
    }
    void this.ide.openUrl(authorizationUrl.toString());
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
export async function performAuth(mcpServer: MCPServerStatus, ide: IDE) {
  const mcpServerUrl = (mcpServer.transport as SSEOptions).url;
  const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  authenticatingMCPContext = {
    authenticatingServer: mcpServer,
    ide,
  };
  return await auth(authProvider, {
    serverUrl: mcpServerUrl,
  });
}

/**
 * handle the authentication code received from the oauth redirect
 */
async function handleMCPOauthCode(authorizationCode: string) {
  if (!authenticatingMCPContext) {
    return;
  }
  const { ide, authenticatingServer } = authenticatingMCPContext;
  const serverUrl = (authenticatingServer.transport as SSEOptions).url;

  if (!serverUrl) {
    void ide.showToast("error", "No MCP server url found for authentication");
    return;
  }
  if (!authorizationCode) {
    void ide.showToast(
      "error",
      `No MCP authorization code found for ${serverUrl}`,
    );
    return;
  }
  server.close(() => console.debug("Server for MCP Oauth process was closed"));
  const authProvider = new MCPConnectionOauthProvider(serverUrl, ide);
  const authStatus = await auth(authProvider, {
    serverUrl,
    authorizationCode,
  });
  if (authStatus === "AUTHORIZED") {
    const { MCPManagerSingleton } = await import("./MCPManagerSingleton"); // put dynamic import to avoid cyclic imports
    await MCPManagerSingleton.getInstance().refreshConnection(
      authenticatingServer.id,
    );
  }
  authenticatingMCPContext = null;
}

export function removeMCPAuth(mcpServer: MCPServerStatus, ide: IDE) {
  const mcpServerUrl = (mcpServer.transport as SSEOptions).url;
  const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  authProvider.clear();
}
