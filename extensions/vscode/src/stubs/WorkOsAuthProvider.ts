import crypto from "crypto";

import { ControlPlaneSessionInfo } from "core/control-plane/client";
import { EXTENSION_NAME, getControlPlaneEnvSync } from "core/control-plane/env";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import {
  authentication,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  Disposable,
  env,
  EventEmitter,
  ExtensionContext,
  ProgressLocation,
  Uri,
  window,
  workspace,
} from "vscode";

import { PromiseAdapter, promiseFromEvent } from "./promiseUtils";
import { SecretStorage } from "./SecretStorage";
import { UriEventHandler } from "./uriHandler";

const AUTH_NAME = "Continue";

const enableControlServerBeta = workspace
  .getConfiguration(EXTENSION_NAME)
  .get<boolean>("enableContinueForTeams", false);
const controlPlaneEnv = getControlPlaneEnvSync(
  true ? "production" : "none",
  enableControlServerBeta,
);

const SESSIONS_SECRET_KEY = `${controlPlaneEnv.AUTH_TYPE}.sessions`;

// Function to generate a random string of specified length
function generateRandomString(length: number): string {
  const possibleCharacters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let randomString = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * possibleCharacters.length);
    randomString += possibleCharacters[randomIndex];
  }
  return randomString;
}

// Function to generate a code challenge from the code verifier

async function generateCodeChallenge(verifier: string) {
  // Create a SHA-256 hash of the verifier
  const hash = crypto.createHash("sha256").update(verifier).digest();

  // Convert the hash to a base64 URL-encoded string
  const base64String = hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return base64String;
}

interface ContinueAuthenticationSession extends AuthenticationSession {
  refreshToken: string;
  expiresInMs: number;
  loginNeeded: boolean;
}

export class WorkOsAuthProvider implements AuthenticationProvider, Disposable {
  private _sessionChangeEmitter =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private _disposable: Disposable;
  private _pendingStates: string[] = [];
  private _codeExchangePromises = new Map<
    string,
    { promise: Promise<string>; cancel: EventEmitter<void> }
  >();

  private static EXPIRATION_TIME_MS = 1000 * 60 * 15; // 15 minutes

  private secretStorage: SecretStorage;

  constructor(
    private readonly context: ExtensionContext,
    private readonly _uriHandler: UriEventHandler,
  ) {
    this._disposable = Disposable.from(
      authentication.registerAuthenticationProvider(
        controlPlaneEnv.AUTH_TYPE,
        AUTH_NAME,
        this,
        { supportsMultipleAccounts: false },
      ),
      window.registerUriHandler(this._uriHandler),
    );

    this.secretStorage = new SecretStorage(context);
  }

  private decodeJwt(jwt: string): Record<string, any> | null {
    try {
      const decodedToken = JSON.parse(
        Buffer.from(jwt.split(".")[1], "base64").toString(),
      );
      return decodedToken;
    } catch (e: any) {
      console.warn(`Error decoding JWT: ${e}`);
      return null;
    }
  }

  private getExpirationTimeMs(jwt: string): number {
    const decodedToken = this.decodeJwt(jwt);
    if (!decodedToken) {
      return WorkOsAuthProvider.EXPIRATION_TIME_MS;
    }
    return decodedToken.exp && decodedToken.iat
      ? (decodedToken.exp - decodedToken.iat) * 1000
      : WorkOsAuthProvider.EXPIRATION_TIME_MS;
  }

  private jwtIsExpiredOrInvalid(jwt: string): boolean {
    const decodedToken = this.decodeJwt(jwt);
    if (!decodedToken) {
      return true;
    }
    return decodedToken.exp * 1000 < Date.now();
  }

  private async debugAccessTokenValidity(jwt: string, refreshToken: string) {
    const expiredOrInvalid = this.jwtIsExpiredOrInvalid(jwt);
    if (expiredOrInvalid) {
      console.debug("Invalid JWT");
    } else {
      console.debug("Valid JWT");
    }
  }

  private async storeSessions(value: ContinueAuthenticationSession[]) {
    const data = JSON.stringify(value, null, 2);
    await this.secretStorage.store(SESSIONS_SECRET_KEY, data);
  }

  public async getSessions(
    scopes?: string[],
  ): Promise<ContinueAuthenticationSession[]> {
    const data = await this.secretStorage.get(SESSIONS_SECRET_KEY);
    if (!data) {
      return [];
    }

    try {
      const value = JSON.parse(data) as ContinueAuthenticationSession[];
      return value;
    } catch (e: any) {
      console.warn(`Error parsing sessions.json: ${e}`);
      return [];
    }
  }

  get onDidChangeSessions() {
    return this._sessionChangeEmitter.event;
  }

  get ideRedirectUri() {
    if (
      env.uriScheme === "vscode-insiders" ||
      env.uriScheme === "vscode" ||
      env.uriScheme === "code-oss"
    ) {
      // We redirect to a page that says "you can close this page", and that page finishes the redirect
      const url = new URL(controlPlaneEnv.APP_URL);
      url.pathname = `/auth/${env.uriScheme}-redirect`;
      return url.toString();
    }
    const publisher = this.context.extension.packageJSON.publisher;
    const name = this.context.extension.packageJSON.name;
    return `${env.uriScheme}://${publisher}.${name}`;
  }

  public static useOnboardingUri: boolean = false;
  get redirectUri() {
    if (WorkOsAuthProvider.useOnboardingUri) {
      const url = new URL(controlPlaneEnv.APP_URL);
      url.pathname = `/onboarding/redirect/${env.uriScheme}`;
      return url.toString();
    }
    return this.ideRedirectUri;
  }

  async refreshSessions() {
    try {
      await this._refreshSessions();
    } catch (e) {
      console.error(`Error refreshing sessions: ${e}`);
    }
  }

  private async _refreshSessions(): Promise<void> {
    const sessions = await this.getSessions();
    if (!sessions.length) {
      return;
    }

    const finalSessions = [];
    for (const session of sessions) {
      try {
        const newSession = await this._refreshSession(session.refreshToken);
        finalSessions.push({
          ...session,
          accessToken: newSession.accessToken,
          refreshToken: newSession.refreshToken,
          expiresInMs: newSession.expiresInMs,
        });
      } catch (e: any) {
        // If the refresh token doesn't work, we just drop the session
        console.debug(`Error refreshing session token: ${e.message}`);
        await this.debugAccessTokenValidity(
          session.accessToken,
          session.refreshToken,
        );
        this._sessionChangeEmitter.fire({
          added: [],
          removed: [session],
          changed: [],
        });
        // We don't need to refresh the sessions again, since we'll get a new one when we need it
        // setTimeout(() => this._refreshSessions(), 60 * 1000);
        // return;
      }
    }
    await this.storeSessions(finalSessions);
    this._sessionChangeEmitter.fire({
      added: [],
      removed: [],
      changed: finalSessions,
    });

    if (finalSessions[0]?.expiresInMs) {
      setTimeout(
        async () => {
          await this._refreshSessions();
        },
        (finalSessions[0].expiresInMs * 2) / 3,
      );
    }
  }

  private async _refreshSession(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresInMs: number;
  }> {
    const response = await fetch(
      new URL("/auth/refresh", controlPlaneEnv.CONTROL_PLANE_URL),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error("Error refreshing token: " + text);
    }
    const data = (await response.json()) as any;
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresInMs: this.getExpirationTimeMs(data.accessToken),
    };
  }

  private _formatProfileLabel(
    firstName: string | null,
    lastName: string | null,
  ) {
    return ((firstName ?? "") + " " + (lastName ?? "")).trim();
  }

  /**
   * Create a new auth session
   * @param scopes
   * @returns
   */
  public async createSession(
    scopes: string[],
  ): Promise<ContinueAuthenticationSession> {
    try {
      const codeVerifier = generateRandomString(64);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const token = await this.login(codeChallenge, scopes);
      if (!token) {
        throw new Error(`Continue login failure`);
      }

      const userInfo = (await this.getUserInfo(token, codeVerifier)) as any;
      const { user, access_token, refresh_token } = userInfo;

      const session: ContinueAuthenticationSession = {
        id: uuidv4(),
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresInMs: this.getExpirationTimeMs(access_token),
        loginNeeded: false,
        account: {
          label: this._formatProfileLabel(user.first_name, user.last_name),
          id: user.email,
        },
        scopes: [],
      };

      await this.storeSessions([session]);

      this._sessionChangeEmitter.fire({
        added: [session],
        removed: [],
        changed: [],
      });

      setTimeout(
        () => this._refreshSessions(),
        (this.getExpirationTimeMs(session.accessToken) * 2) / 3,
      );

      return session;
    } catch (e) {
      window.showErrorMessage(`Sign in failed: ${e}`);
      throw e;
    }
  }

  /**
   * Remove an existing session
   * @param sessionId
   */
  public async removeSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions();
    const sessionIdx = sessions.findIndex((s) => s.id === sessionId);
    const session = sessions[sessionIdx];
    sessions.splice(sessionIdx, 1);

    await this.storeSessions(sessions);

    if (session) {
      this._sessionChangeEmitter.fire({
        added: [],
        removed: [session],
        changed: [],
      });
    }
  }

  /**
   * Dispose the registered services
   */
  public async dispose() {
    this._disposable.dispose();
  }

  /**
   * Log in to Continue
   */
  private async login(codeChallenge: string, scopes: string[] = []) {
    return await window.withProgress<string>(
      {
        location: ProgressLocation.Notification,
        title: "Signing in to Continue...",
        cancellable: true,
      },
      async (_, token) => {
        const stateId = uuidv4();

        this._pendingStates.push(stateId);

        const scopeString = scopes.join(" ");

        const url = new URL("https://api.workos.com/user_management/authorize");
        const params = {
          response_type: "code",
          client_id: controlPlaneEnv.WORKOS_CLIENT_ID,
          redirect_uri: this.redirectUri,
          state: stateId,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          provider: "authkit",
        };

        Object.keys(params).forEach((key) =>
          url.searchParams.append(key, params[key as keyof typeof params]),
        );

        const oauthUrl = url;
        if (oauthUrl) {
          await env.openExternal(Uri.parse(oauthUrl.toString()));
        } else {
          return;
        }

        let codeExchangePromise = this._codeExchangePromises.get(scopeString);
        if (!codeExchangePromise) {
          codeExchangePromise = promiseFromEvent(
            this._uriHandler.event,
            this.handleUri(scopes),
          );
          this._codeExchangePromises.set(scopeString, codeExchangePromise);
        }

        try {
          return await Promise.race([
            codeExchangePromise.promise,
            new Promise<string>(
              (_, reject) =>
                setTimeout(() => reject("Cancelled"), 60 * 60 * 1_000), // 60min timeout
            ),
            promiseFromEvent<any, any>(
              token.onCancellationRequested,
              (_, __, reject) => {
                reject("User Cancelled");
              },
            ).promise,
          ]);
        } finally {
          this._pendingStates = this._pendingStates.filter(
            (n) => n !== stateId,
          );
          codeExchangePromise?.cancel.fire();
          this._codeExchangePromises.delete(scopeString);
        }
      },
    );
  }

  /**
   * Handle the redirect to VS Code (after sign in from Continue)
   * @param scopes
   * @returns
   */
  private handleUri: (
    scopes: readonly string[],
  ) => PromiseAdapter<Uri, string> =
    (scopes) => async (uri, resolve, reject) => {
      const query = new URLSearchParams(uri.query);
      const access_token = query.get("code");
      const state = query.get("state");

      if (!access_token) {
        reject(new Error("No token"));
        return;
      }
      if (!state) {
        reject(new Error("No state"));
        return;
      }

      // Check if it is a valid auth request started by the extension
      if (!this._pendingStates.some((n) => n === state)) {
        reject(new Error("State not found"));
        return;
      }

      resolve(access_token);
    };

  /**
   * Get the user info from WorkOS
   * @param token
   * @returns
   */
  private async getUserInfo(token: string, codeVerifier: string) {
    const resp = await fetch(
      "https://api.workos.com/user_management/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: controlPlaneEnv.WORKOS_CLIENT_ID,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          code: token,
        }),
      },
    );
    const text = await resp.text();
    const data = JSON.parse(text);
    return data;
  }
}

export async function getControlPlaneSessionInfo(
  silent: boolean,
  useOnboarding: boolean,
): Promise<ControlPlaneSessionInfo | undefined> {
  try {
    if (useOnboarding) {
      WorkOsAuthProvider.useOnboardingUri = true;
    }

    const session = await authentication.getSession(
      controlPlaneEnv.AUTH_TYPE,
      [],
      silent ? { silent: true } : { createIfNone: true },
    );
    if (!session) {
      return undefined;
    }
    return {
      accessToken: session.accessToken,
      account: {
        id: session.account.id,
        label: session.account.label,
      },
    };
  } finally {
    WorkOsAuthProvider.useOnboardingUri = false;
  }
}
