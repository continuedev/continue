import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { TabTitle } from "../components/OnboardingCardTabs";
import { setOnboardingCard } from "../../../redux/slices/uiSlice";
import { OnboardingCardState } from "..";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { saveCurrentSession } from "../../../redux/thunks/session";

export interface UseOnboardingCard {
  show: OnboardingCardState["show"];
  activeTab: OnboardingCardState["activeTab"];
  setActiveTab: (tab: TabTitle) => void;
  open: (tab: TabTitle) => void;
  close: () => void;
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

    // Used to clear the chat panel before showing onboarding card
    dispatch(
      saveCurrentSession({
        openNewSession: true,
      }),
    );

    dispatch(setOnboardingCard({ show: true, activeTab: tab }));
  }

  function close() {
    setLocalStorage("hasDismissedOnboardingCard", true);
    dispatch(setOnboardingCard({ show: false }));
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
