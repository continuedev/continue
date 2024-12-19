import { useAppSelector } from "../redux/hooks";
import { selectDefaultModel } from "../redux/slices/configSlice";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../util/freeTrial";
import FreeTrialProgressBar from "./loaders/FreeTrialProgressBar";
import ProfileSwitcher from "./ProfileSwitcher";

function Footer() {
  const defaultModel = useAppSelector(selectDefaultModel);

    return (
      <footer className="flex h-7 items-center justify-between overflow-hidden border-0 border-t border-solid border-t-zinc-700 p-2">
        <div className="flex max-w-[40vw] gap-2">
          <ProfileSwitcher />
          {defaultModel?.provider === "free-trial" && <FreeTrialProgressBar
            completed={parseInt(localStorage.getItem("ftc") || "0")}
            total={FREE_TRIAL_LIMIT_REQUESTS}
          />}
        </div>
      </footer>
    );
  // return null;
}

export default Footer;
