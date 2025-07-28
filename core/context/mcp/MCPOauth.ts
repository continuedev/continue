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

let currentMCPAuthServerUrl = "";

const PORT = 3000;

const server = http.createServer((req, res) => {
  try {
    if (!req.url) {
      throw new Error("no url found");
    }
    const parsedUrl = url.parse(req.url, true);
    if (parsedUrl.pathname !== "/") {
      throw new Error("path is not index");
    }

    const query = new URLSearchParams(
      parsedUrl.query as Record<string, string>,
    ).toString();
    if (!query) {
      throw new Error("no query params found");
    }

    const redirectUrl = `vscode://continue.Continue?${query}`;

    res.writeHead(302, {
      Location: redirectUrl,
    });
    res.end();
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Unexpected redirect error:  ${(error as Error).message}`);
  }
});

// TODO: start the server only when mcp oauth process starts and kill when done
server.listen(PORT, () => {
  console.log(
    `Server running for MCP Oauth process at http://localhost:${PORT}/`,
  );
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
    console.log(
      "debug1 mcp oauth storage",
      this.globalContext.get("mcpOauthStorage"),
    );
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
    console.log(
      "debug1 after clearing mcp oauth storage",
      this.globalContext.get("mcpOauthStorage"),
    );
  }

  async redirectToAuthorization(authorizationUrl: URL) {
    console.log("debug1 redirecting to url", authorizationUrl);
    // TODO here the url needs to be sent to the extension
    this.ide.openUrl(authorizationUrl.toString());
  }
}

// TODO: first fetch can fail - need to refresh from gui
export async function getOauthToken(mcpServerUrl: string, ide: IDE) {
  const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  const tokens = await authProvider.tokens();
  return tokens?.access_token;
}

export async function performAuth(mcpServer: MCPServerStatus, ide: IDE) {
  const mcpServerUrl = (mcpServer.transport as SSEOptions).url;
  const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  return await auth(authProvider, {
    serverUrl: mcpServerUrl,
  });
}

export async function handleMCPOauthCode(authorizationCode: string, ide: IDE) {
  const serverUrl = "https://mcp.asana.com/sse";
  if (!authorizationCode) {
    ide.showToast("error", `No MCP authorization code found for ${serverUrl}`);
  }

  console.log("debug1 authenticating ", {
    serverUrl,
    authorizationCode,
  });
  const authProvider = new MCPConnectionOauthProvider(serverUrl, ide);
  return await auth(authProvider, {
    serverUrl,
    authorizationCode,
  });
}

export function removeMCPAuth(mcpServer: MCPServerStatus, ide: IDE) {
  const mcpServerUrl = (mcpServer.transport as SSEOptions).url;
  const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  authProvider.clear();
}
