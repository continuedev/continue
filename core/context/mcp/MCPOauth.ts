import {
  OAuthClientProvider,
  auth,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { IDE } from "../..";

import http from "http";
import url from "url";

const PORT = 3000;

const server = http.createServer((req, res) => {
  // TODO: instead of sending bad requests for each case, try catch handle the bad request at the end of the function
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad Request");
    return;
  }
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === "/") {
    const query = new URLSearchParams(
      parsedUrl.query as Record<string, string>,
    ).toString();
    if (!query) {
      console.error("no query params found!");
    }
    const redirectUrl = `vscode://continue.Continue${query ? "?" + query : ""}`;

    res.writeHead(302, {
      Location: redirectUrl,
    });
    res.end();
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

class MCPConnectionOauthProvider implements OAuthClientProvider {
  constructor(
    public oauthServerUrl: string,
    private ide: IDE,
  ) {}

  get redirectUrl() {
    return "http://localhost:3000"; // TODO: this has to be a hub url or should we spin up a server?
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

  saveClientInformation(clientInformation: OAuthClientInformationFull) {}

  async clientInformation() {
    return undefined;
  }

  async tokens() {
    return undefined;
  }

  saveTokens(tokens: OAuthTokens) {}

  codeVerifier(): string | Promise<string> {
    return "";
  }

  saveCodeVerifier(codeVerifier: string) {}

  clear() {}

  async redirectToAuthorization(authorizationUrl: URL) {
    console.log("debug1 redirecting to url", authorizationUrl);
    // TODO here the url needs to be sent to the extension
    this.ide.openUrl(authorizationUrl.toString());
  }
}

export async function performAuth(mcpServerUrl: string, ide: IDE) {
  const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
  await auth(authProvider, { serverUrl: mcpServerUrl });

  // full uri is of the format "https://localhost:3000/?code=712020%253Abed80c83-1041-49e0-99b5-5d4f9f8aa538%3ACSlICEGG3rzCQhla%3AHA0oJYDjijnNE8nCoADpZsSp8jr7cCSZ"
  // const input = await ide.showInput({
  //   prompt: "Paste the auth code here",
  // });
  // const result = await auth(authProvider, {
  //   serverUrl: mcpServerUrl,
  //   authorizationCode: input,
  // });
  // if (result === "AUTHORIZED") {
  //   void ide.showToast(
  //     "info",
  //     `Authenticated with ${new URL(mcpServerUrl).hostname} MCP server`,
  //   );
  // } else {
  //   void ide.showToast(
  //     "error",
  //     `Failed to authenticate with ${new URL(mcpServerUrl).hostname} MCP server`,
  //   );
  // }
}
