import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { ControlPlaneSessionInfo } from "core/control-plane/client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import AccountDialog from "../components/AccountDialog";
import ConfirmationDialog from "../components/dialogs/ConfirmationDialog";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppSelector } from "../redux/hooks";
import { setLastControlServerBetaEnabledStatus } from "../redux/slices/miscSlice";
import {
  selectAvailableProfiles,
  setAvailableProfiles,
} from "../redux/slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import { IdeMessengerContext } from "./IdeMessenger";

interface AuthContextType {
  session: ControlPlaneSessionInfo | undefined;
  logout: () => void;
  login: (useOnboarding: boolean) => Promise<boolean>;
  selectedProfile: ProfileDescription | undefined;
  profiles: ProfileDescription[];
  controlServerBetaEnabled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<ControlPlaneSessionInfo | undefined>(
    undefined,
  );

  const profiles = useAppSelector(selectAvailableProfiles);

  const selectedProfileId = useAppSelector(
    (store) => store.session.selectedProfileId,
  );
  const selectedProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId);
  }, [profiles, selectedProfileId]);

  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  const lastControlServerBetaEnabledStatus = useAppSelector(
    (state) => state.misc.lastControlServerBetaEnabledStatus,
  );

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

          // If this is the first time the user has logged in, explain how profiles work
          if (!getLocalStorage("shownProfilesIntroduction")) {
            dispatch(setShowDialog(true));
            dispatch(
              setDialogMessage(
                <ConfirmationDialog
                  title="Welcome to Continue for Teams!"
                  text="You can switch between your local profile and team profile using the profile icon in the top right. Each profile defines a set of models, slash commands, context providers, and other settings to customize Continue."
                  hideCancelButton={true}
                  confirmText="Ok"
                  onConfirm={() => {}}
                />,
              ),
            );
            setLocalStorage("shownProfilesIntroduction", true);
          }

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
          }}
          onCancel={() => {
            dispatch(setDialogMessage(<AccountDialog />));
            dispatch(setShowDialog(true));
          }}
        />,
      ),
    );
  };

  useWebviewListener("didChangeControlPlaneSessionInfo", async (data) => {
    setSession(data.sessionInfo);
  });

  useWebviewListener("signInToControlPlane", async () => {
    login(false);
  });

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

  const [controlServerBetaEnabled, setControlServerBetaEnabled] =
    useState(false);

  useEffect(() => {
    ideMessenger.ide.getIdeSettings().then(({ enableControlServerBeta }) => {
      setControlServerBetaEnabled(enableControlServerBeta);
      dispatch(setLastControlServerBetaEnabledStatus(enableControlServerBeta));

      const shouldShowPopup =
        !lastControlServerBetaEnabledStatus && enableControlServerBeta;
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
    "didChangeAvailableProfiles",
    async (data) => {
      dispatch(setAvailableProfiles(data.profiles));
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        logout,
        login,
        selectedProfile,
        profiles,
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
