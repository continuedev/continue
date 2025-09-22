import { EventEmitter as NodeEventEmitter } from "node:events";

import {
  AuthType,
  ControlPlaneSessionInfo,
  ShihuoSessionInfo,
} from "core/control-plane/AuthTypes";
import { Logger } from "core/util/Logger";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import {
  authentication,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  Disposable,
  env,
  EventEmitter,
  ExtensionContext,
  ProgressLocation,
  Uri,
  window,
} from "vscode";

import { PromiseAdapter, promiseFromEvent } from "./promiseUtils";
import { SecretStorage } from "./SecretStorage";
import { UriEventHandler } from "./uriHandler";

const AUTH_NAME = "Shihuo SSO";
const AUTH_TYPE = "shihuo-sso";

const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

// API Response interface
interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

// User Info interface
interface UserInfo {
  name: string;
  email?: string;
  id?: string;
  avatar?: string;
  dept_name?: string;
}

interface ShihuoAuthenticationSession extends AuthenticationSession {
  expiresInMs: number;
  loginNeeded: boolean;
  account: AuthenticationSessionAccountInformation & {
    avatar?: string;
    dept_name?: string;
  };
}

export class ShihuoAuthProvider implements AuthenticationProvider, Disposable {
  private _sessionChangeEmitter =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private _disposable: Disposable;
  private _pendingStates: string[] = [];
  private _codeExchangePromises = new Map<
    string,
    { promise: Promise<string>; cancel: EventEmitter<void> }
  >();

  private static EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24; // 24 hours

  private secretStorage: SecretStorage;

  constructor(
    private readonly context: ExtensionContext,
    private readonly _uriHandler: UriEventHandler,
  ) {
    this._disposable = Disposable.from(
      authentication.registerAuthenticationProvider(
        AUTH_TYPE,
        AUTH_NAME,
        this,
        { supportsMultipleAccounts: false },
      ),
      // Don't register URI handler here - it's already registered by WorkOsAuthProvider
    );

    this.secretStorage = new SecretStorage(context);

    // Immediately refresh any existing sessions
    this.attemptEmitter = new NodeEventEmitter();
    ShihuoAuthProvider.hasAttemptedRefresh = new Promise((resolve) => {
      this.attemptEmitter.on("attempted", resolve);
    });

    // Delay the refresh to ensure everything is initialized
    setTimeout(() => {
      void this.refreshSessions();
    }, 0);
  }

  private async storeSessions(value: ShihuoAuthenticationSession[]) {
    if (!this.secretStorage) {
      console.warn("SecretStorage not initialized, cannot store sessions");
      return;
    }

    const data = JSON.stringify(value, null, 2);
    await this.secretStorage.store(SESSIONS_SECRET_KEY, data);
  }

  public async getSessions(
    scopes?: string[],
  ): Promise<ShihuoAuthenticationSession[]> {
    if (!this.secretStorage) {
      console.warn("SecretStorage not initialized, returning empty sessions");
      return [];
    }

    const data = await this.secretStorage.get(SESSIONS_SECRET_KEY);
    if (!data) {
      return [];
    }

    try {
      const value = JSON.parse(data) as ShihuoAuthenticationSession[];
      return value;
    } catch (e: any) {
      Logger.error(e, {
        context: "shihuo_sessions_json_parse",
        dataLength: data.length,
      });

      console.warn(`Error parsing sessions.json: ${e}`);
      return [];
    }
  }

  get onDidChangeSessions() {
    return this._sessionChangeEmitter.event;
  }

  get redirectUri() {
    // Direct redirect to VSCode, not through Continue website
    // Shihuo SSO will redirect directly to VSCode with the authorization code
    const scheme = env.uriScheme || "vscode";
    return `${scheme}://continue.continue/shihuo`;
  }

  public static hasAttemptedRefresh: Promise<void>;
  private attemptEmitter: NodeEventEmitter;

  async refreshSessions() {
    const sessions = await this.getSessions();
    if (!sessions.length) {
      this.attemptEmitter.emit("attempted");
      return;
    }

    // For now, we'll assume tokens are valid until they expire
    // In a real implementation, you might want to validate tokens with the server
    this.attemptEmitter.emit("attempted");
  }

  /**
   * Create a new auth session
   * @param scopes
   * @returns
   */
  public async createSession(
    scopes: string[],
  ): Promise<ShihuoAuthenticationSession> {
    try {
      const token = await this.login(scopes);
      if (!token) {
        throw new Error(`Shihuo SSO login failure`);
      }

      // Get user info using the token
      const userInfo = await this.getUserInfo(token);

      const session: ShihuoAuthenticationSession = {
        id: uuidv4(),
        accessToken: token,
        expiresInMs: ShihuoAuthProvider.EXPIRATION_TIME_MS,
        loginNeeded: false,
        account: {
          label: userInfo.name,
          id: userInfo.email || userInfo.name,
          avatar: userInfo.avatar,
          dept_name: userInfo.dept_name,
        },
        scopes: [],
      };

      await this.storeSessions([session]);

      this._sessionChangeEmitter.fire({
        added: [session],
        removed: [],
        changed: [],
      });

      return session;
    } catch (e) {
      Logger.error(e, {
        context: "shihuo_auth_session_creation",
        scopes: scopes.join(","),
      });

      void window.showErrorMessage(`Shihuo SSO sign in failed: ${e}`);
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
   * Log in to Shihuo SSO
   */
  private async login(scopes: string[] = []) {
    return await window.withProgress<string>(
      {
        location: ProgressLocation.Notification,
        title: "Signing in to Shihuo SSO...",
        cancellable: true,
      },
      async (_, token) => {
        const stateId = uuidv4();
        this._pendingStates.push(stateId);

        // Open SSO login page
        const ssoUrl = `https://sso.shizhi-inc.com/login?target=${encodeURIComponent(this.redirectUri)}&state=${stateId}`;
        console.log("ssoUrl", ssoUrl);

        await env.openExternal(Uri.parse(ssoUrl));

        let codeExchangePromise = this._codeExchangePromises.get("shihuo");
        if (!codeExchangePromise) {
          codeExchangePromise = promiseFromEvent(
            this._uriHandler.event,
            this.handleUri(scopes),
          );
          this._codeExchangePromises.set("shihuo", codeExchangePromise);
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
          this._codeExchangePromises.delete("shihuo");
        }
      },
    );
  }

  /**
   * Handle the redirect to VS Code (after sign in from Shihuo SSO)
   * @param scopes
   * @returns
   */
  private handleUri: (
    scopes: readonly string[],
  ) => PromiseAdapter<Uri, string> =
    (scopes) => async (uri, resolve, reject) => {
      try {
        const code: string | null = new URLSearchParams(uri.query).get("code");
        if (!code) {
          reject(new Error("No authorization code"));
          return;
        }

        // Exchange code for token
        console.log("Exchanging code for token:", code);
        const tokenUrl = `https://sso.shihuo.cn/api/code2Token?code=${code}`;
        console.log("Token exchange URL:", tokenUrl);

        const tokenRes = await fetch(tokenUrl);
        console.log("Token response status:", tokenRes.status);
        console.log(
          "Token response headers:",
          Object.fromEntries(tokenRes.headers.entries()),
        );

        const tokenData = (await tokenRes.json()) as ApiResponse<string>;
        console.log("Token response data:", tokenData);

        if (tokenData.code !== 0 || !tokenData.data) {
          console.error("Token exchange failed:", tokenData);
          reject(new Error("Failed to exchange code for token"));
          return;
        }

        const token: string = tokenData.data;
        resolve(token);
      } catch (err) {
        console.error("Shihuo SSO login failed", err);
        reject(new Error("Shihuo SSO login failed"));
      }
    };

  /**
   * Get the user info from Shihuo SSO
   * @param token
   * @returns
   */
  private async getUserInfo(token: string): Promise<UserInfo> {
    console.log(
      "Getting user info with token:",
      token.substring(0, 20) + "...",
    );
    const userUrl = "https://sso.shihuo.cn/api/checkToken?check_type=1";
    console.log("User info URL:", userUrl);

    const userRes = await fetch(userUrl, {
      headers: { Authorization: token },
    });
    console.log("User info response status:", userRes.status);
    console.log(
      "User info response headers:",
      Object.fromEntries(userRes.headers.entries()),
    );

    const userData = (await userRes.json()) as ApiResponse<{
      user_info: UserInfo;
    }>;
    console.log("User info response data:", userData);

    if (userData.code !== 0 || !userData.data?.user_info) {
      console.error("Get user info failed:", userData);
      throw new Error("Failed to get user info");
    }

    return userData.data.user_info;
  }
}

export async function getShihuoSessionInfo(
  silent: boolean,
): Promise<ControlPlaneSessionInfo | undefined> {
  try {
    await ShihuoAuthProvider.hasAttemptedRefresh;
    const session = await authentication.getSession(
      AUTH_TYPE,
      [],
      silent ? { silent: true } : { createIfNone: true },
    );

    if (!session) {
      return undefined;
    }

    const result = {
      AUTH_TYPE: AuthType.ShihuoSSO,
      accessToken: session.accessToken,
      account: {
        id: session.account.id,
        label: session.account.label,
        avatar: (session.account as any).avatar,
        dept_name: (session.account as any).dept_name,
      },
    } as ShihuoSessionInfo;

    return result;
  } catch (e) {
    Logger.error(e, {
      context: "shihuo_get_session_info",
    });
    return undefined;
  }
}

/**
 * Check if user is authenticated with Shihuo SSO
 * Returns true if authenticated, false otherwise
 */
export async function isShihuoAuthenticated(): Promise<boolean> {
  try {
    const sessionInfo = await getShihuoSessionInfo(true);
    return (
      sessionInfo !== undefined && sessionInfo.AUTH_TYPE === AuthType.ShihuoSSO
    );
  } catch (e) {
    Logger.error(e, {
      context: "shihuo_check_authentication",
    });
    return false;
  }
}

/**
 * Ensure user is authenticated with Shihuo SSO before proceeding
 * Shows login prompt if not authenticated
 * Returns true if authenticated, false if user cancelled or failed
 */
export async function ensureShihuoAuthentication(): Promise<boolean> {
  const isAuthenticated = await isShihuoAuthenticated();

  if (isAuthenticated) {
    return true;
  }

  // Show login prompt
  const loginChoice = await window.showWarningMessage(
    "请先登录Shihuo SSO才能使用Continue插件功能",
    "登录",
    "取消",
  );

  if (loginChoice === "登录") {
    try {
      const sessionInfo = await getShihuoSessionInfo(false);
      return sessionInfo !== undefined;
    } catch (e) {
      Logger.error(e, {
        context: "shihuo_login_attempt",
      });
      await window.showErrorMessage("登录失败，请重试");
      return false;
    }
  }

  return false;
}
