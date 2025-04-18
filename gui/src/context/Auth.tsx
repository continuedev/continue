import {
  OrganizationDescription,
  ProfileDescription,
} from "core/config/ProfileLifecycleManager";
import { ControlPlaneSessionInfo } from "core/control-plane/client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import ConfirmationDialog from "../components/dialogs/ConfirmationDialog";
import { useWebviewListener } from "../hooks/useWebviewListener";
import {
  selectCurrentOrg,
  selectSelectedProfile,
  setOrganizations,
  setSelectedOrgId,
} from "../redux/";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import { IdeMessengerContext } from "./IdeMessenger";

interface AuthContextType {
  session: ControlPlaneSessionInfo | undefined;
  logout: () => void;
  login: (useOnboarding: boolean) => Promise<boolean>;
  selectedProfile: ProfileDescription | null;
  profiles: ProfileDescription[] | null;
  refreshProfiles: () => void;
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
    return new Promise((resolve) => {
      ideMessenger
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
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          confirmText="Yes, log out"
          text="Are you sure you want to log out of Continue?"
          onConfirm={() => {
            ideMessenger.post("logoutOfControlPlane", undefined);
            dispatch(
              setOrganizations(orgs.filter((org) => org.id === "personal")),
            );
            dispatch(setSelectedOrgId("personal"));
            setSession(undefined);
          }}
          onCancel={() => {
            dispatch(setDialogMessage(undefined));
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
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
    },
    [],
  );

  const refreshProfiles = useCallback(async () => {
    try {
      await ideMessenger.request("config/refreshProfiles", undefined);
      ideMessenger.post("showToast", ["info", "Config refreshed"]);
    } catch (e) {
      console.error("Failed to refresh profiles", e);
      ideMessenger.post("showToast", ["error", "Failed to refresh config"]);
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
