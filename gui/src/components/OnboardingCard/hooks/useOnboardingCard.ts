import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { TabTitle } from "../components/OnboardingCardTabs";
import {
  setDialogMessage,
  setOnboardingCard,
  setShowDialog,
} from "../../../redux/slices/uiSlice";
import { OnboardingCardState } from "..";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { saveCurrentSession } from "../../../redux/thunks/session";

export interface UseOnboardingCard {
  show: OnboardingCardState["show"];
  activeTab: OnboardingCardState["activeTab"];
  setActiveTab: (tab: TabTitle) => void;
  open: (tab: TabTitle) => void;
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

  // Always show if we explicitly want to, e.g. passing free trial
  // and setting up keys
  if (onboardingCard.show) {
    show = true;
  } else {
    show = onboardingStatus !== "Completed" && !hasDismissedOnboardingCard;
  }

  async function open(tab: TabTitle) {
    navigate("/");
    dispatch(setOnboardingCard({ show: true, activeTab: tab }));
  }

  function close(isDialog = false) {
    setLocalStorage("hasDismissedOnboardingCard", true);
    dispatch(setOnboardingCard({ show: false }));
    if (isDialog) {
      dispatch(setDialogMessage(undefined));
      dispatch(setShowDialog(false));
    }
  }

  function setActiveTab(tab: TabTitle) {
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
