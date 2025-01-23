import { useAuth } from "../../../../context/Auth";
import ContinueLogo from "../../../gui/ContinueLogo";
import { useOnboardingCard } from "../../hooks";

export default function LocalTab() {
  const onboardingCard = useOnboardingCard();
  const auth = useAuth();

  return (
    <div className="xs:px-0 flex w-full max-w-full flex-col items-center justify-center px-4 text-center">
      <div className="xs:flex hidden">
        <ContinueLogo height={75} />
      </div>

      <p className="xs:w-3/4 w-full text-sm">
        Log in to quickly build your first custom AI code assistant
      </p>

      {/* <p className="xs:w-3/4 w-full text-sm">
              To prevent abuse, we'll ask you to sign in to GitHub.
            </p> */}

      <div className="mt-4 w-full"></div>
    </div>
  );
}
