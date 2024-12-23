import { useDispatch } from "react-redux";
import { useNavigate, useRouteError } from "react-router-dom";
import { newSession } from "../redux/slices/sessionSlice";
import { GithubIcon } from "../components/svg/GithubIcon";
import { DiscordIcon } from "../components/svg/DiscordIcon";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { Button, SecondaryButton } from "../components";
import { ArrowPathIcon, FlagIcon } from "@heroicons/react/24/outline";
import { DISCORD_LINK, GITHUB_LINK } from "core/util/constants";

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

      <p className="mb-0 mt-6 text-lg">
        Report the issue on GitHub or Discord:
      </p>

      <div className="flex space-x-4">
        <SecondaryButton
          onClick={() => openUrl(GITHUB_LINK)}
          className="flex w-full items-center justify-center space-x-2 rounded-lg px-4 py-2 text-base text-white"
        >
          <GithubIcon size={20} /> <span className="ml-2">GitHub</span>
        </SecondaryButton>
        <SecondaryButton
          onClick={() => openUrl(DISCORD_LINK)}
          className="flex w-full items-center justify-center rounded-lg text-base"
        >
          <DiscordIcon size={20} /> <span className="ml-2">Discord</span>
        </SecondaryButton>
      </div>
    </div>
  );
};

export default ErrorPage;
