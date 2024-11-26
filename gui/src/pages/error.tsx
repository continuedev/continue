import { useDispatch } from "react-redux";
import { useNavigate, useRouteError } from "react-router-dom";
import { newSession } from "../redux/slices/stateSlice";
// import ContinueButton from "../components/mainInput/ContinueButton";
// import { vscBackground } from "../components";
import { GithubIcon } from "../components/svg/GithubIcon";
// import { useState } from "react";
import { DiscordIcon } from "../components/svg/DiscordIcon";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { Button, SecondaryButton } from "../components";
import ContinueButton from "../components/mainInput/ContinueButton";
import {
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import Loader from "../components/loaders/Loader";
import RingLoader from "../components/loaders/RingLoader";

// const GITHUB_LINK = "https://github.com/continuedev/continue/issues/new/choose";
// const DISCORD_LINK = "https://discord.com/invite/EfJEfdFnDQ";

// export default function ErrorPage() {
//   const error: any = useRouteError();
//   console.error(error);
//   const dispatch = useDispatch();
//   const navigate = useNavigate();

//   return (
//     <div className="text-center" style={{ backgroundColor: vscBackground }}>
//       <h1>Error in Continue React App</h1>
//       <p>
//         <i>{error.statusText || error.message}</i>
//       </p>
//       <br />
//       <p>Click below to Continue</p>

//       <br />
//       <ContinueButton
//         disabled={false}
//         showStop={false}
//         onClick={() => {
//           dispatch(newSession());
//           localStorage.removeItem("persist:root");
//           localStorage.removeItem("inputHistory_chat");
//           // localStorage.removeItem("showTutorialCard");
//           // localStorage.removeItem("onboardingStatus");
//           // localStorage.removeItem("lastSessionId");
//           navigate("/");
//         }}
//       ></ContinueButton>

//       <GithubIcon />
//       <DiscordIcon />
//     </div>
//   );
// }

const GITHUB_LINK = "https://github.com/continuedev/continue/issues/new/choose";
const DISCORD_LINK = "https://discord.com/invite/EfJEfdFnDQ";

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
    <div className="bg- flex min-h-screen flex-col items-center justify-center px-8 py-4 text-center">
      <h1 className="mb-4 text-3xl font-bold">Error in Continue React App</h1>

      <pre className="pb-6">
        <code className="px-3 py-2">{error.statusText || error.message}</code>
      </pre>

      <Button
        className="flex flex-row items-center gap-2"
        onClick={() => {
          dispatch(newSession());
          localStorage.removeItem("persist:root");
          localStorage.removeItem("inputHistory_chat");
          // localStorage.removeItem("showTutorialCard");
          // localStorage.removeItem("onboardingStatus");
          // localStorage.removeItem("lastSessionId");
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

      <p className="mb-0 mt-6">Report the issue:</p>
      <div className="mt-4 flex space-x-4">
        <SecondaryButton
          onClick={() => openUrl(GITHUB_LINK)}
          className="flex items-center space-x-2 rounded-lg px-4 py-2 text-white"
        >
          <GithubIcon size={20} />
        </SecondaryButton>
        <SecondaryButton
          onClick={() => openUrl(DISCORD_LINK)}
          className="flex items-center rounded-lg"
        >
          <DiscordIcon size={20} />
        </SecondaryButton>
      </div>
    </div>
  );
};

export default ErrorPage;
