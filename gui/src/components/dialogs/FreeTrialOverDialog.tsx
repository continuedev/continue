import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { useAppSelector } from "../../redux/hooks";
import { useEffect } from "react";
import { selectUsePlatform } from "../../redux/selectors";
import { PlatformOnboardingCard } from "../OnboardingCard/platform/PlatformOnboardingCard";
import { OnboardingCard } from "../OnboardingCard";

function FreeTrialOverDialog() {
  const dispatch = useDispatch();
  const history = useAppSelector((store) => store.session.history);
  const usePlatform = useAppSelector(selectUsePlatform);

  useEffect(() => {
    if (history.length === 0) {
      dispatch(setShowDialog(false));
      dispatch(setDialogMessage(undefined));
    }
  }, [history]);

  return (
    <div className="flex-1">
      {usePlatform ? (
        <PlatformOnboardingCard isDialog />
      ) : (
        <OnboardingCard isDialog />
      )}
    </div>
  );
}

export default FreeTrialOverDialog;
