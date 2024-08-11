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
  UriHandler,
  window,
} from "vscode";
import { PromiseAdapter, promiseFromEvent } from "./promiseUtils";

export const AUTH_TYPE = "continue";
const AUTH_NAME = "Continue";
const CLIENT_ID =
  process.env.CONTROL_PLANE_ENV === "local"
    ? "client_01J0FW6XCPMJMQ3CG51RB4HBZQ"
    : "client_01J0FW6XN8N2XJAECF7NE0Y65J";
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

class UriEventHandler extends EventEmitter<Uri> implements UriHandler {
  public handleUri(uri: Uri) {
    this.fire(uri);
  }
}

import {
  CONTROL_PLANE_URL,
  ControlPlaneSessionInfo,
} from "core/control-plane/client";
import crypto from "crypto";

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
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
  private _uriHandler = new UriEventHandler();
  private _sessions: ContinueAuthenticationSession[] = [];

  private static EXPIRATION_TIME_MS = 1000 * 60 * 5; // 5 minutes

  constructor(private readonly context: ExtensionContext) {
    this._disposable = Disposable.from(
      authentication.registerAuthenticationProvider(
        AUTH_TYPE,
        AUTH_NAME,
        this,
        { supportsMultipleAccounts: false },
      ),
      window.registerUriHandler(this._uriHandler),
    );
  }

  get onDidChangeSessions() {
    return this._sessionChangeEmitter.event;
  }

  get redirectUri() {
    const publisher = this.context.extension.packageJSON.publisher;
    const name = this.context.extension.packageJSON.name;
    return `${env.uriScheme}://${publisher}.${name}`;
  }

  async initialize() {
    let sessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
    this._sessions = sessions ? JSON.parse(sessions) : [];
    await this._refreshSessions();
  }

  private async _refreshSessions(): Promise<void> {
    if (!this._sessions.length) {
      return;
    }
    for (const session of this._sessions) {
      try {
        const newSession = await this._refreshSession(session.refreshToken);
        session.accessToken = newSession.accessToken;
        session.refreshToken = newSession.refreshToken;
        session.expiresIn = newSession.expiresIn;
      } catch (e: any) {
        if (e.message === "Network failure") {
          setTimeout(() => this._refreshSessions(), 60 * 1000);
          return;
        }
      }
    }
    await this.context.secrets.store(
      SESSIONS_SECRET_KEY,
      JSON.stringify(this._sessions),
    );
    this._sessionChangeEmitter.fire({
      added: [],
      removed: [],
      changed: this._sessions,
    });

    if (this._sessions[0].expiresIn) {
      setTimeout(
        () => this._refreshSessions(),
        (this._sessions[0].expiresIn * 2) / 3,
      );
    }
  }

  private async _refreshSession(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const response = await fetch(new URL("/auth/refresh", CONTROL_PLANE_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error("Error refreshing token: " + text);
    }
    const data = (await response.json()) as any;
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: WorkOsAuthProvider.EXPIRATION_TIME_MS,
    };
  }

  /**
   * Get the existing sessions
   * @param scopes
   * @returns
   */
  public async getSessions(
    scopes?: string[],
  ): Promise<readonly ContinueAuthenticationSession[]> {
    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);

    if (allSessions) {
      return JSON.parse(allSessions) as ContinueAuthenticationSession[];
    }

    return [];
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
        expiresIn: WorkOsAuthProvider.EXPIRATION_TIME_MS,
        account: {
          label: user.first_name + " " + user.last_name,
          id: user.email,
        },
        scopes: [],
      };

      await this.context.secrets.store(
        SESSIONS_SECRET_KEY,
        JSON.stringify([session]),
      );

      this._sessionChangeEmitter.fire({
        added: [session],
        removed: [],
        changed: [],
      });

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
    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
    if (allSessions) {
      let sessions = JSON.parse(allSessions) as ContinueAuthenticationSession[];
      const sessionIdx = sessions.findIndex((s) => s.id === sessionId);
      const session = sessions[sessionIdx];
      sessions.splice(sessionIdx, 1);

      await this.context.secrets.store(
        SESSIONS_SECRET_KEY,
        JSON.stringify(sessions),
      );

      if (session) {
        this._sessionChangeEmitter.fire({
          added: [],
          removed: [session],
          changed: [],
        });
      }
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
          client_id: CLIENT_ID,
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
            new Promise<string>((_, reject) =>
              setTimeout(() => reject("Cancelled"), 60000),
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
          client_id: CLIENT_ID,
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
): Promise<ControlPlaneSessionInfo | undefined> {
  const session = await authentication.getSession(
    "continue",
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
}
