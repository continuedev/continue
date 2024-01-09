import { ModelProvider } from "../..";
import OpenAI from "./OpenAI";

class SAPGenAIHub extends OpenAI {
    private tokenCache: { token: string; expiry: number } | null = null;

    static providerName: ModelProvider = "sap-gen-ai-hub";

    private _getTokenParams(): { authURL: string; clientID: string; clientSecret: string } {
        if (!this.authURL || !this.clientID || !this.clientSecret) {
            throw new Error("Authentication parameters (authURL, clientID, clientSecret) are undefined");
        }
        return {
            authURL: this.authURL.endsWith("/oauth/token") ? this.authURL : `${this.authURL}/oauth/token`,
            clientID: this.clientID,
            clientSecret: this.clientSecret,
        };
    }

    private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Request timed out')), timeout);

            fetch(url, options)
                .then(response => {
                    clearTimeout(timer);
                    resolve(response);
                })
                .catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    private async fetchOAuthToken(): Promise<string> {
        const params = this._getTokenParams();
        const response = await this.fetchWithTimeout(params.authURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: params.clientID,
                client_secret: params.clientSecret,
                grant_type: 'client_credentials',
            }).toString(),
        }, 10000); // 10-second timeout

        const data = await response.json();
        return data.access_token;
    }

    private async ensureToken(): Promise<void> {
        if (!this.tokenCache || Date.now() >= this.tokenCache.expiry) {
            const token = await this.fetchOAuthToken();
            const expiry = Date.now() + 3600 * 1000; // Consider making this configurable
            this.tokenCache = { token, expiry };
        }
    }

    protected async _getRequestHeaders(): Promise<Record<string, string>> {
        await this.ensureToken();
        const header: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.tokenCache?.token}`,
            "api-key": this.apiKey || "",
            "AI-Resource-Group": this.resourceGroup || "default",
        };
        return header;
    }

    protected _getChatUrl() {
        if (this.apiType === "azure") {
          return `${this.apiBase}/chat/completions?api-version=${this.apiVersion}`;
        } else {
          let url = this.apiBase;
          if (!url) {
            throw new Error(
              "No API base URL provided. Please set the 'apiBase' option in config.json"
            );
          }
          if (url.endsWith("/")) {
            url = url.slice(0, -1);
          }

          if (!url.endsWith("/v1")) {
            url += "/v1";
          }
          return url + "/chat/completions";
        }
      }

      protected _getCompletionUrl() {
        if (this.apiType === "azure") {
          return `${this.apiBase}/completions?api-version=${this.apiVersion}`;
        } else {
          let url = this.apiBase;
          if (!url) {
            throw new Error(
              "No API base URL provided. Please set the 'apiBase' option in config.json"
            );
          }
          if (url.endsWith("/")) {
            url = url.slice(0, -1);
          }
          if (!url.endsWith("/v1")) {
            url += "/v1";
          }
          return url + "/completions";
        }
      }

}

export default SAPGenAIHub;
