import { ControlPlaneSessionInfo } from "core/control-plane/client";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import ConfirmationDialog from "../components/dialogs/ConfirmationDialog";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiStateSlice";

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

  useEffect(() => {
    ideMessenger
      .request("getControlPlaneSessionInfo", { silent: true })
      .then(setSession);
  }, []);

  const login = () => {
    ideMessenger
      .request("getControlPlaneSessionInfo", { silent: false })
      .then(setSession);
  };

  const logout = () => {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          text={"Click the user icon in the bottom left of VS Code to log out."}
          onConfirm={() => {}}
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
