import { useDispatch } from "react-redux";
import { useNavigate, useRouteError } from "react-router-dom";
import { newSession } from "../redux/slices/stateSlice";
import ContinueButton from "../components/mainInput/ContinueButton";
import { vscBackground } from "../components";
import { GithubIcon } from "../components/svg/Github";

export default function ErrorPage() {
  const error: any = useRouteError();
  console.error(error);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return (
    <div className="text-center" style={{ backgroundColor: vscBackground }}>
      <h1>Error in Continue React App</h1>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
      <br />
      <p>Click below to Continue</p>
      <GithubIcon />
      <br />
      <ContinueButton
        disabled={false}
        showStop={false}
        onClick={() => {
          dispatch(newSession());
          localStorage.removeItem("persist:root");
          localStorage.removeItem("inputHistory_chat");
          // localStorage.removeItem("showTutorialCard");
          // localStorage.removeItem("onboardingStatus");
          // localStorage.removeItem("lastSessionId");
          navigate("/");
        }}
      ></ContinueButton>
    </div>
  );
}
