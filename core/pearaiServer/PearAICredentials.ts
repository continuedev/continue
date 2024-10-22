import { PearAuth } from "../index.js";
import { checkTokens } from "../db/token.js";

export class PearAICredentials {
  private accessToken: string | undefined;
  private refreshToken: string | undefined;
  private getCredentials: (() => Promise<PearAuth | undefined>) | undefined;
  private setCredentials: (auth: PearAuth) => Promise<void>;

  constructor(
    getCredentials: (() => Promise<PearAuth | undefined>) | undefined,
    setCredentials: (auth: PearAuth) => Promise<void>
  ) {
    this.getCredentials = getCredentials;
    this.setCredentials = setCredentials;
  }

  public setAccessToken(value: string | undefined): void {
    console.log('Setting access token:', value);
    this.accessToken = value;
    console.log('Access token set to:', this.accessToken);
  }

  public setRefreshToken(value: string | undefined): void {
    console.log('Setting refresh token:', value);
    this.refreshToken = value;
    console.log('Refresh token set to:', this.refreshToken);
  }

  public getAccessToken(): string | undefined {
    console.log('Getting access token');
    const token = this.accessToken;
    console.log('Returning access token:', token);
    return token;
  }

  public async checkAndUpdateCredentials(): Promise<boolean> {
    try {
      let creds: PearAuth | undefined;

      if (this.getCredentials && this.accessToken === undefined) {
        console.log("Attempting to get credentials...");
        creds = await this.getCredentials();

        if (creds && creds.accessToken && creds.refreshToken) {
          this.accessToken = creds.accessToken;
          this.refreshToken = creds.refreshToken;
        } else {
          return false;
        }
      }

      const tokens = await checkTokens(this.accessToken, this.refreshToken);

      if (tokens.accessToken !== this.accessToken || tokens.refreshToken !== this.refreshToken) {
        if (tokens.accessToken !== this.accessToken) {
          this.accessToken = tokens.accessToken;
          console.log(
            "PearAI access token changed from:",
            this.accessToken,
            "to:",
            tokens.accessToken
          );
        }

        if (tokens.refreshToken !== this.refreshToken) {
          this.refreshToken = tokens.refreshToken;
          console.log(
            "PearAI refresh token changed from:",
            this.refreshToken,
            "to:",
            tokens.refreshToken
          );
        }
        if (creds) {
          creds.accessToken = tokens.accessToken;
          creds.refreshToken = tokens.refreshToken;
          await this.setCredentials(creds);
        }
      }
    } catch (error) {
      console.error("Error checking token expiration:", error);
      return false;
    }
    return true;
  }
}
