export interface HubSessionInfo {
  AUTH_TYPE: AuthType.WorkOsProd | AuthType.WorkOsStaging;
  accessToken: string;
  account: {
    label: string;
    id: string;
  };
}

export interface OnPremSessionInfo {
  AUTH_TYPE: AuthType.OnPrem;
}

export interface ShihuoSessionInfo {
  AUTH_TYPE: AuthType.ShihuoSSO;
  accessToken: string;
  account: {
    label: string;
    id: string;
    avatar?: string;
    dept_name?: string;
  };
}

export type ControlPlaneSessionInfo =
  | HubSessionInfo
  | OnPremSessionInfo
  | ShihuoSessionInfo;

// Multi-session management
export interface MultiSessionInfo {
  continueSession?: ControlPlaneSessionInfo;
  shihuoSession?: ControlPlaneSessionInfo;
  activeSessionType?:
    | AuthType.WorkOsProd
    | AuthType.WorkOsStaging
    | AuthType.ShihuoSSO;
}

export function isOnPremSession(
  sessionInfo: ControlPlaneSessionInfo | undefined,
): sessionInfo is OnPremSessionInfo {
  return sessionInfo !== undefined && sessionInfo.AUTH_TYPE === AuthType.OnPrem;
}

export function isShihuoSession(
  sessionInfo: ControlPlaneSessionInfo | undefined,
): sessionInfo is ShihuoSessionInfo {
  return (
    sessionInfo !== undefined && sessionInfo.AUTH_TYPE === AuthType.ShihuoSSO
  );
}

export function isHubSession(
  sessionInfo: ControlPlaneSessionInfo | undefined,
): sessionInfo is HubSessionInfo {
  return (
    sessionInfo !== undefined &&
    (sessionInfo.AUTH_TYPE === AuthType.WorkOsProd ||
      sessionInfo.AUTH_TYPE === AuthType.WorkOsStaging)
  );
}

// Helper function to get active session from multi-session info
export function getActiveSession(
  multiSession: MultiSessionInfo,
): ControlPlaneSessionInfo | undefined {
  if (!multiSession.activeSessionType) {
    return undefined;
  }

  switch (multiSession.activeSessionType) {
    case AuthType.WorkOsProd:
    case AuthType.WorkOsStaging:
      return multiSession.continueSession;
    case AuthType.ShihuoSSO:
      return multiSession.shihuoSession;
    default:
      return undefined;
  }
}

export enum AuthType {
  WorkOsProd = "continue",
  WorkOsStaging = "continue-staging",
  OnPrem = "on-prem",
  ShihuoSSO = "shihuo-sso",
}

export interface HubEnv {
  DEFAULT_CONTROL_PLANE_PROXY_URL: string;
  CONTROL_PLANE_URL: string;
  AUTH_TYPE: AuthType.WorkOsProd | AuthType.WorkOsStaging;
  WORKOS_CLIENT_ID: string;
  APP_URL: string;
}

export interface OnPremEnv {
  AUTH_TYPE: AuthType.OnPrem;
  DEFAULT_CONTROL_PLANE_PROXY_URL: string;
  CONTROL_PLANE_URL: string;
  APP_URL: string;
}

export type ControlPlaneEnv = HubEnv | OnPremEnv;

export function isHubEnv(env: ControlPlaneEnv): env is HubEnv {
  return (
    "AUTH_TYPE" in env &&
    env.AUTH_TYPE !== "on-prem" &&
    "WORKOS_CLIENT_ID" in env
  );
}
