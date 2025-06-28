import {
  OrganizationDescription,
  ProfileDescription,
} from "core/config/ProfileLifecycleManager";
import { ControlPlaneSessionInfo } from "core/control-plane/AuthTypes";
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
  logout: () => void;
  login: (useOnboarding: boolean) => Promise<boolean>;
  selectedProfile: ProfileDescription | null;
  profiles: ProfileDescription[] | null;
  refreshProfiles: () => Promise<void>;
  organizations: OrganizationDescription[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  // Session
  const [session, setSession] = useState<ControlPlaneSessionInfo | undefined>(
    undefined,
  );

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

          const session = result.content;
          setSession(session);

          resolve(true);
        });
    });
  };

  const logout = () => {
    ideMessenger.post("logoutOfControlPlane", undefined);
    dispatch(setOrganizations(orgs.filter((org) => org.id === "personal")));
    dispatch(setSelectedOrgId("personal"));
    setSession(undefined);
  };

  useEffect(() => {
    async function init() {
      const result = await ideMessenger.request("getControlPlaneSessionInfo", {
        silent: true,
        useOnboarding: false,
      });
      if (result.status === "success") {
        setSession(result.content);
      }
    }
    void init();
  }, []);

  useWebviewListener(
    "sessionUpdate",
    async (data) => {
      setSession(data.sessionInfo);
      void refreshProfiles();
    },
    [],
  );

  const refreshProfiles = useCallback(async () => {
    try {
      dispatch(setConfigLoading(true));
      await ideMessenger.request("config/refreshProfiles", undefined);
      ideMessenger.post("showToast", ["info", "Config refreshed"]);
    } catch (e) {
      console.error("Failed to refresh profiles", e);
      ideMessenger.post("showToast", ["error", "Failed to refresh config"]);
    } finally {
      dispatch(setConfigLoading(false));
    }
  }, [ideMessenger]);

  return (
    <AuthContext.Provider
      value={{
        session,
        logout,
        login,
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
