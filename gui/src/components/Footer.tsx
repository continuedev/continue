import { useAppSelector } from "../redux/hooks";
import { selectDefaultModel } from "../redux/slices/configSlice";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../util/freeTrial";
import FreeTrialProgressBar from "./loaders/FreeTrialProgressBar";

function Footer() {
  const defaultModel = useAppSelector(selectDefaultModel);

  if (defaultModel?.provider === "free-trial") {
    return (
      <footer className="flex flex-col border-0 border-t border-solid border-t-zinc-700 px-2 py-2">
        <FreeTrialProgressBar
          completed={parseInt(localStorage.getItem("ftc") || "0")}
          total={FREE_TRIAL_LIMIT_REQUESTS}
        />
      </footer>
    );
  }
  return null;
}

export default Footer;
