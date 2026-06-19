import { ArrowPathIcon, FlagIcon } from "@heroicons/react/24/outline";
import { DISCUSSIONS_LINK, GITHUB_LINK } from "core/util/constants";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useRouteError } from "react-router-dom";
import { Button, SecondaryButton } from "../components";
import { GithubIcon } from "../components/svg/GithubIcon";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { newSession } from "../redux/slices/sessionSlice";

const ErrorPage: React.FC = () => {
  const error: any = useRouteError();
  console.error(error);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const messenger = useContext(IdeMessengerContext);
  const openUrl = (url: string) => {
    if (messenger) {
      messenger.post("openUrl", url);
    }
  };

  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setInitialLoad(false);
    }, 500);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center px-2 py-4 text-center sm:px-8">
      <h1 className="mb-4 text-3xl font-bold">Oops! Something went wrong</h1>

      <code className="whitespace-wrap mx-2 mb-4 max-w-full break-words py-2">
        {error.statusText || error.message}
      </code>

      <Button
        className="flex flex-row items-center gap-2"
        onClick={() => {
          dispatch(newSession());
          localStorage.removeItem("persist:root");
          localStorage.removeItem("inputHistory_chat");
          // localStorage.removeItem("showTutorialCard");
          // localStorage.removeItem("onboardingStatus");
          navigate("/");
        }}
      >
        {initialLoad ? (
          <FlagIcon className="h-5 w-5 text-red-600" />
        ) : (
          <ArrowPathIcon className="h-5 w-5" />
        )}
        Continue
      </Button>
    </div>
  );
};

export default ErrorPage;
