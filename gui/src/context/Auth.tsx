import {
  OrganizationDescription,
  ProfileDescription,
} from "core/config/ProfileLifecycleManager";
import { ControlPlaneSessionInfo } from "core/control-plane/client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import ConfirmationDialog from "../components/dialogs/ConfirmationDialog";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppSelector } from "../redux/hooks";
import { setLastControlServerBetaEnabledStatus } from "../redux/slices/miscSlice";
import {
  setAvailableOrganizations,
  setAvailableProfiles,
  setSelectedOrganizationId,
  setSelectedProfileId,
} from "../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import { IdeMessengerContext } from "./IdeMessenger";

interface AuthContextType {
  session: ControlPlaneSessionInfo | undefined;
  logout: () => void;
  login: (useOnboarding: boolean) => Promise<boolean>;
  selectedProfile: ProfileDescription | undefined;
  profiles: ProfileDescription[];
  controlServerBetaEnabled: boolean;
  organizations: OrganizationDescription[];
  selectedOrganization: OrganizationDescription | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const [session, setSession] = useState<ControlPlaneSessionInfo | undefined>(
    undefined,
  );

  // Orgs
  const organizations = useAppSelector(
    (store) => store.config.availableOrganizations,
  );
  const selectedOrganizationId = useAppSelector(
    (store) => store.config.selectedOrganizationId,
  );

  const selectedOrganization = useMemo(() => {
    return organizations.find((p) => p.id === selectedOrganizationId);
  }, [organizations, selectedOrganizationId]);

  // Profiles
  const profiles = useAppSelector((store) => store.config.availableProfiles);

  const selectedProfileId = useAppSelector(
    (store) => store.config.selectedProfileId,
  );
  const selectedProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId);
  }, [profiles, selectedProfileId]);

  async function login(useOnboarding: boolean): Promise<boolean> {
    const result = await ideMessenger.request("getControlPlaneSessionInfo", {
      silent: false,
      useOnboarding,
    });
    if (result.status === "error") {
      return false;
    }
    const session = result.content;
    setSession(session);
    return true;
  }

  const logout = () => {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          confirmText="Yes, log out"
          text="Are you sure you want to log out of Continue?"
          onConfirm={() => {
            ideMessenger.post("logoutOfControlPlane", undefined);
          }}
          onCancel={() => {
            dispatch(setDialogMessage(undefined));
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  };

  // IDE settings
  const [controlServerBetaEnabled, setControlServerBetaEnabled] =
    useState(false);

  useEffect(() => {
    ideMessenger.ide
      .getIdeSettings()
      .then(({ enableControlServerBeta, continueTestEnvironment }) => {
        setControlServerBetaEnabled(enableControlServerBeta);
        dispatch(
          setLastControlServerBetaEnabledStatus(enableControlServerBeta),
        );
      });
  }, []);

  useWebviewListener(
    "didChangeIdeSettings",
    async (msg) => {
      const { settings } = msg;
      setControlServerBetaEnabled(settings.enableControlServerBeta);
      dispatch(
        setLastControlServerBetaEnabledStatus(settings.enableControlServerBeta),
      );
    },
    [],
  );

  // Session and Config Profiles State
  useEffect(() => {
    ideMessenger
      .request("getControlPlaneSessionInfo", {
        silent: true,
        useOnboarding: false,
      })
      .then(
        (result) => result.status === "success" && setSession(result.content),
      );
  }, []);

  // useEffect(() => {
  //   if (session) {
  //     ideMessenger
  //       .request("controlPlane/listOrganizations", undefined)
  //       .then((result) => {
  //         if (result.status === "success") {
  //           dispatch(setAvailableOrganizations(result.content));
  //         }
  //       });
  //   } else {
  //     dispatch(setAvailableOrganizations([]));
  //   }
  // }, [session]);

  useEffect(() => {
    ideMessenger
      .request("config/listProfiles", undefined)
      .then(
        (result) =>
          result.status === "success" &&
          dispatch(setAvailableProfiles(result.content)),
      );
  }, []);

  useWebviewListener(
    "config/didChangeSession",
    async (data) => {
      setSession(data.session);
      dispatch(setAvailableOrganizations(data.organizations));
      dispatch(setSelectedOrganizationId(data.selectedOrganizationId));
    },
    [],
  );

  useWebviewListener("config/didChangeProfiles", async (data) => {
    dispatch(setAvailableProfiles(data.profiles));
    dispatch(setSelectedProfileId(data.selectedProfileId));
  });

  useWebviewListener;

  return (
    <AuthContext.Provider
      value={{
        session,
        logout,
        login,
        selectedProfile,
        profiles,
        selectedOrganization,
        organizations,
        controlServerBetaEnabled,
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
