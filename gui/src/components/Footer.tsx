import {
  Cog6ToothIcon,
  EllipsisHorizontalCircleIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import { RootState } from "../redux/store";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../util/freeTrial";
import ButtonWithTooltip from "./ButtonWithTooltip";
import FreeTrialProgressBar from "./loaders/FreeTrialProgressBar";
import ProfileSwitcher from "./ProfileSwitcher";

function Footer() {
  const navigate = useNavigate();
  const defaultModel = useSelector(defaultModelSelector);
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedProfileId = useSelector(
    (store: RootState) => store.state.selectedProfileId,
  );

  function onClickMore() {
    if (location.pathname === "/more") {
      navigate("/");
    } else {
      navigate("/more");
    }
  }

  function onClickSettings() {
    if (selectedProfileId === "local") {
      ideMessenger.post("openConfigJson", undefined);
    } else {
      ideMessenger.post(
        "openUrl",
        `http://app.continue.dev/workspaces/${selectedProfileId}/config`,
      );
    }
  }

  return (
    <footer className="flex justify-between items-center overflow-hidden p-2 h-7 border-0 border-t border-solid border-t-zinc-700">
      <div className="flex gap-2 max-w-[40vw]">
        <ProfileSwitcher />
        {defaultModel?.provider === "free-trial" && (
          <FreeTrialProgressBar
            completed={parseInt(localStorage.getItem("ftc") || "0")}
            total={FREE_TRIAL_LIMIT_REQUESTS}
          />
        )}
      </div>

      <div className="flex gap-1">
        <ButtonWithTooltip
          tooltipPlacement="top-end"
          text="More"
          onClick={onClickMore}
        >
          <EllipsisHorizontalCircleIcon className="w-4 h-4" />
        </ButtonWithTooltip>

        <ButtonWithTooltip
          tooltipPlacement="top-end"
          onClick={onClickSettings}
          text="Configure Continue"
        >
          <Cog6ToothIcon className="w-4 h-4" />
        </ButtonWithTooltip>
      </div>
    </footer>
  );
}

export default Footer;
