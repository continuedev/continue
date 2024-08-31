import { ControlPlaneSessionInfo } from "core/control-plane/client";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import ConfirmationDialog from "../components/dialogs/ConfirmationDialog";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiStateSlice";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import { useWebviewListener } from "./useWebviewListener";

export function useAuth(): {
  session: ControlPlaneSessionInfo | undefined;
  logout: () => void;
  login: () => void;
} {
  const [session, setSession] = useState<ControlPlaneSessionInfo | undefined>(
    undefined,
  );
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  useWebviewListener("didChangeControlPlaneSessionInfo", async (data) => {
    setSession(data.sessionInfo);
  });

  useEffect(() => {
    ideMessenger
      .request("getControlPlaneSessionInfo", { silent: true })
      .then(
        (result) => result.status === "success" && setSession(result.content),
      );
  }, []);

  const login = () => {
    ideMessenger
      .request("getControlPlaneSessionInfo", { silent: false })
      .then((result) => {
        if (result.status === "error") {
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
                text={
                  "Welcome to Continue for teams! Using the toggle in the bottom right, you can switch between your local profile (defined by config.json) and team profiles (defined in the Continue for teams web app). Each profile defines a set of models, slash commands, context providers, and other settings to customize Continue."
                }
                hideCancelButton={true}
                confirmText="Ok"
                onConfirm={() => {}}
              />,
            ),
          );
          setLocalStorage("shownProfilesIntroduction", true);
        }
      });
  };

  const logout = () => {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          confirmText="Yes, log out"
          text={"Are you sure you want to log out of Continue?"}
          onConfirm={() => {
            ideMessenger.request("logoutOfControlPlane", undefined);
          }}
        />,
      ),
    );
  };

  return {
    session,
    logout,
    login,
  };
}
