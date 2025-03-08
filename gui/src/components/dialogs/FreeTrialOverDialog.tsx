import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../redux/hooks";
import { selectUseHub } from "../../redux/selectors";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { OnboardingCard } from "../OnboardingCard";
import { PlatformOnboardingCard } from "../OnboardingCard/platform/PlatformOnboardingCard";

function FreeTrialOverDialog() {
  const dispatch = useDispatch();
  const history = useAppSelector((store) => store.session.history);
  const usePlatform = useAppSelector(selectUseHub);

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
