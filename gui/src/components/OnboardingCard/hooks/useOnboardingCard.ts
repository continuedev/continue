import { OnboardingModes } from "core/protocol/core";
import { useNavigate } from "react-router-dom";
import { OnboardingCardState } from "..";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  setDialogMessage,
  setOnboardingCard,
  setShowDialog,
} from "../../../redux/slices/uiSlice";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";

export interface UseOnboardingCard {
  show: OnboardingCardState["show"];
  activeTab: OnboardingCardState["activeTab"];
  setActiveTab: (tab: OnboardingModes) => void;
  open: (tab?: OnboardingModes) => void;
  close: (isDialog?: boolean) => void;
}

export function useOnboardingCard(): UseOnboardingCard {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const onboardingCard = useAppSelector((state) => state.ui.onboardingCard);

  const onboardingStatus = getLocalStorage("onboardingStatus");
  const hasDismissedOnboardingCard = getLocalStorage(
    "hasDismissedOnboardingCard",
  );

  let show: boolean;

  // Always show if we explicitly want to, e.g. setting up keys
  if (onboardingCard.show) {
    show = true;
  } else {
    show = onboardingStatus !== "Completed" && !hasDismissedOnboardingCard;
  }

  async function open(tab?: OnboardingModes) {
    // Clear the dismissal flag set by `close`. The redux `show` flag is not
    // persisted, so without this the card disappears again on the next reload.
    setLocalStorage("hasDismissedOnboardingCard", false);
    navigate("/");
    dispatch(
      setOnboardingCard({
        show: true,
        activeTab: tab ?? OnboardingModes.API_KEY,
      }),
    );
  }

  function close(isDialog = false) {
    setLocalStorage("hasDismissedOnboardingCard", true);
    dispatch(setOnboardingCard({ show: false }));
    if (isDialog) {
      dispatch(setDialogMessage(undefined));
      dispatch(setShowDialog(false));
    }
  }

  function setActiveTab(tab: OnboardingModes) {
    dispatch(setOnboardingCard({ show: true, activeTab: tab }));
  }

  return {
    show,
    setActiveTab,
    open,
    close,
    activeTab: onboardingCard.activeTab,
  };
}
