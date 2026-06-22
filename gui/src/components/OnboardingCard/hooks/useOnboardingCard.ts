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

<<<<<<< HEAD
  // Always show if we explicitly want to, e.g. passing free trial
  // and setting up keys
=======
  // Always show if we explicitly want to, e.g. setting up keys
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  if (onboardingCard.show) {
    show = true;
  } else {
    show = onboardingStatus !== "Completed" && !hasDismissedOnboardingCard;
  }

  async function open(tab?: OnboardingModes) {
    navigate("/");
    dispatch(
      setOnboardingCard({
        show: true,
<<<<<<< HEAD
        activeTab: tab ?? OnboardingModes.MODELS_ADD_ON,
=======
        activeTab: tab ?? OnboardingModes.API_KEY,
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
