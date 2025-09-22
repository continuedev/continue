import {
  ProfileDescription,
  SerializedOrgWithProfiles,
} from "core/config/ProfileLifecycleManager";
import {
  AuthType,
  ControlPlaneSessionInfo,
  getActiveSession,
  MultiSessionInfo,
} from "core/control-plane/AuthTypes";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setConfigLoading } from "../redux/slices/configSlice";
import {
  selectCurrentOrg,
  selectSelectedProfile,
  setOrganizations,
  setSelectedOrgId,
} from "../redux/slices/profilesSlice";
import { IdeMessengerContext } from "./IdeMessenger";

interface AuthContextType {
  session: ControlPlaneSessionInfo | undefined;
  multiSession: MultiSessionInfo;
  logout: () => void;
  logoutContinue: () => void;
  logoutShihuo: () => void;
  login: (useOnboarding: boolean) => Promise<boolean>;
  loginWithShihuo: () => Promise<boolean>;
  switchToSession: (
    sessionType:
      | AuthType.WorkOsProd
      | AuthType.WorkOsStaging
      | AuthType.ShihuoSSO,
  ) => void;
  selectedProfile: ProfileDescription | null;
  profiles: ProfileDescription[] | null;
  refreshProfiles: (reason?: string) => Promise<void>;
  organizations: SerializedOrgWithProfiles[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  // Multi-session management
  const [multiSession, setMultiSession] = useState<MultiSessionInfo>({
    continueSession: undefined,
    shihuoSession: undefined,
    activeSessionType: undefined,
  });

  // Current active session (computed from multiSession)
  const session = getActiveSession(multiSession);

  // Orgs
  const orgs = useAppSelector((store) => store.profiles.organizations);

  // Profiles
  const currentOrg = useAppSelector(selectCurrentOrg);
  const selectedProfile = useAppSelector(selectSelectedProfile);

  const login: AuthContextType["login"] = (useOnboarding: boolean) => {
    return new Promise(async (resolve) => {
      await ideMessenger
        .request("getControlPlaneSessionInfo", {
          silent: false,
          useOnboarding,
        })
        .then((result) => {
          if (result.status === "error") {
            resolve(false);
            return;
          }

          const continueSession = result.content;
          setMultiSession((prev) => ({
            ...prev,
            continueSession,
            activeSessionType:
              continueSession?.AUTH_TYPE === AuthType.OnPrem
                ? undefined
                : continueSession?.AUTH_TYPE,
          }));

          resolve(true);
        });
    });
  };

  const loginWithShihuo: AuthContextType["loginWithShihuo"] = () => {
    return new Promise(async (resolve) => {
      await ideMessenger
        .request("getShihuoSessionInfo", {
          silent: false,
        })
        .then((result) => {
          if (result.status === "error") {
            resolve(false);
            return;
          }

          const shihuoSession = result.content;
          setMultiSession((prev) => ({
            ...prev,
            shihuoSession,
            activeSessionType:
              shihuoSession?.AUTH_TYPE === AuthType.OnPrem
                ? undefined
                : shihuoSession?.AUTH_TYPE,
          }));

          resolve(true);
        });
    });
  };

  const logout = () => {
    // Logout from both sessions
    ideMessenger.post("logoutOfControlPlane", undefined);
    ideMessenger.post("logoutOfShihuo", undefined);
    dispatch(setOrganizations(orgs.filter((org) => org.id === "personal")));
    dispatch(setSelectedOrgId("personal"));
    setMultiSession({
      continueSession: undefined,
      shihuoSession: undefined,
      activeSessionType: undefined,
    });
  };

  const logoutContinue = () => {
    ideMessenger.post("logoutOfControlPlane", undefined);
    setMultiSession((prev) => ({
      ...prev,
      continueSession: undefined,
      activeSessionType: prev.shihuoSession ? AuthType.ShihuoSSO : undefined,
    }));
  };

  const logoutShihuo = () => {
    ideMessenger.post("logoutOfShihuo", undefined);
    setMultiSession((prev) => ({
      ...prev,
      shihuoSession: undefined,
      activeSessionType:
        prev.continueSession &&
        prev.continueSession.AUTH_TYPE !== AuthType.OnPrem
          ? prev.continueSession.AUTH_TYPE
          : undefined,
    }));
  };

  const switchToSession = (
    sessionType:
      | AuthType.WorkOsProd
      | AuthType.WorkOsStaging
      | AuthType.ShihuoSSO,
  ) => {
    setMultiSession((prev) => ({
      ...prev,
      activeSessionType: sessionType,
    }));
  };

  useEffect(() => {
    async function init() {
      // Initialize both sessions
      const [continueResult, shihuoResult] = await Promise.all([
        ideMessenger.request("getControlPlaneSessionInfo", {
          silent: true,
          useOnboarding: false,
        }),
        ideMessenger.request("getShihuoSessionInfo", {
          silent: true,
        }),
      ]);

      const continueSession =
        continueResult.status === "success"
          ? continueResult.content
          : undefined;
      const shihuoSession =
        shihuoResult.status === "success" ? shihuoResult.content : undefined;

      setMultiSession({
        continueSession,
        shihuoSession,
        activeSessionType:
          (continueSession?.AUTH_TYPE !== AuthType.OnPrem
            ? continueSession?.AUTH_TYPE
            : undefined) ||
          (shihuoSession?.AUTH_TYPE !== AuthType.OnPrem
            ? shihuoSession?.AUTH_TYPE
            : undefined),
      });
    }
    void init();
  }, []);

  useWebviewListener(
    "sessionUpdate",
    async (data) => {
      const sessionInfo = data.sessionInfo;
      if (sessionInfo) {
        if (sessionInfo.AUTH_TYPE === AuthType.ShihuoSSO) {
          setMultiSession((prev) => ({
            ...prev,
            shihuoSession: sessionInfo,
            activeSessionType: prev.activeSessionType || AuthType.ShihuoSSO,
          }));
        } else if (
          sessionInfo.AUTH_TYPE === AuthType.WorkOsProd ||
          sessionInfo.AUTH_TYPE === AuthType.WorkOsStaging
        ) {
          setMultiSession((prev) => ({
            ...prev,
            continueSession: sessionInfo,
            activeSessionType: prev.activeSessionType || sessionInfo.AUTH_TYPE,
          }));
        }
      }
    },
    [],
  );

  const refreshProfiles = useCallback(
    async (reason?: string) => {
      try {
        dispatch(setConfigLoading(true));
        await ideMessenger.request("config/refreshProfiles", {
          reason,
        });
        ideMessenger.post("showToast", ["info", "Config refreshed"]);
      } catch (e) {
        console.error("Failed to refresh profiles", e);
        ideMessenger.post("showToast", ["error", "Failed to refresh config"]);
      } finally {
        dispatch(setConfigLoading(false));
      }
    },
    [ideMessenger],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        multiSession,
        logout,
        logoutContinue,
        logoutShihuo,
        login,
        loginWithShihuo,
        switchToSession,
        selectedProfile,
        profiles: currentOrg?.profiles ?? [],
        refreshProfiles,
        organizations: orgs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
