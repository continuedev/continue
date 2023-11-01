import { useDispatch } from "react-redux";
import { useRouteError } from "react-router-dom";
import { newSession } from "../redux/slices/sessionStateReducer";
import useContinueGUIProtocol from "../hooks/useContinueClient";
import ContinueButton from "../components/ContinueButton";
import { vscBackground } from "../components";

export default function ErrorPage() {
  const error: any = useRouteError();
  console.error(error);
  const dispatch = useDispatch();
  const client = useContinueGUIProtocol(false);

  return (
    <div
      id="error-page"
      className="text-center"
      style={{ backgroundColor: vscBackground }}
    >
      <h1>Error in Continue React App</h1>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
      <br />
      <p>Click below to Continue</p>
      <br />
      <ContinueButton
        disabled={false}
        showStop={false}
        onClick={() => {
          client?.stopSession();
          dispatch(newSession());
        }}
      ></ContinueButton>
    </div>
  );
}
