import { useAppSelector } from "../redux/hooks";
import { selectSelectedChatModel } from "../redux/slices/configSlice";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../util/freeTrial";
import { getLocalStorage } from "../util/localStorage";
import FreeTrialProgressBar from "./loaders/FreeTrialProgressBar";

function Footer() {
  const defaultModel = useAppSelector(selectSelectedChatModel);

  if (defaultModel?.provider === "free-trial") {
    return (
      <footer className="flex flex-col border-0 border-t border-solid border-t-zinc-700 px-2 py-2">
        <FreeTrialProgressBar
          completed={getLocalStorage("ftc") ?? 0}
          total={FREE_TRIAL_LIMIT_REQUESTS}
        />
      </footer>
    );
  }
  return null;
}

export default Footer;
