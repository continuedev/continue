import {
  Cog6ToothIcon,
  EllipsisHorizontalCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import { RootState } from "../redux/store";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../util/freeTrial";
import { ROUTES } from "../util/navigation";
import ButtonWithTooltip from "./ButtonWithTooltip";
import FreeTrialProgressBar from "./loaders/FreeTrialProgressBar";
import ProfileSwitcher from "./ProfileSwitcher";

function Footer() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const defaultModel = useSelector(defaultModelSelector);
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedProfileId = useSelector(
    (store: RootState) => store.state.selectedProfileId,
  );
  const configError = useSelector(
    (store: RootState) => store.state.configError,
  );

  function onClickMore() {
    navigate(pathname === ROUTES.MORE ? "/" : ROUTES.MORE);
  }

  function onClickError() {
    navigate(pathname === ROUTES.CONFIG_ERROR ? "/" : ROUTES.CONFIG_ERROR);
  }

  function onClickSettings() {
    if (selectedProfileId === "local") {
      ideMessenger.post("openConfigJson", undefined);
    } else {
      ideMessenger.post(
        "openUrl",
        `http://app.continue.dev/workspaces/${selectedProfileId}/chat`,
      );
    }
  }

  return (
    <footer className="flex h-7 items-center justify-between overflow-hidden border-0 border-t border-solid border-t-zinc-700 p-2">
      <div className="flex max-w-[40vw] gap-2">
        <ProfileSwitcher />
        {defaultModel?.provider === "free-trial" && (
          <FreeTrialProgressBar
            completed={parseInt(localStorage.getItem("ftc") || "0")}
            total={FREE_TRIAL_LIMIT_REQUESTS}
          />
        )}
      </div>

      <div className="flex gap-1">
        {configError && (
          <ButtonWithTooltip
            tooltipPlacement="top-end"
            text="Config error"
            onClick={onClickError}
          >
            <ExclamationTriangleIcon className="h-4 w-4" />
          </ButtonWithTooltip>
        )}

        <ButtonWithTooltip
          tooltipPlacement="top-end"
          text="More"
          onClick={onClickMore}
        >
          <EllipsisHorizontalCircleIcon className="h-4 w-4" />
        </ButtonWithTooltip>

        <ButtonWithTooltip
          tooltipPlacement="top-end"
          onClick={onClickSettings}
          text="Configure Continue"
        >
          <Cog6ToothIcon className="h-4 w-4" />
        </ButtonWithTooltip>
      </div>
    </footer>
  );
}

export default Footer;
