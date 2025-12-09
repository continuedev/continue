import { CheckIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { Button } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { selectFirstHubProfile } from "../../../redux/thunks/selectFirstHubProfile";
import { useOnboardingCard } from "../hooks/useOnboardingCard";

/**
 * Models Add-On tab component with two-step onboarding:
 * 1. Create Account - Uses auth.login(true) to sign up and redirect back to IDE
 * 2. Purchase Credits - Opens /settings/billing to purchase credits
 */
export function OnboardingModelsAddOnTab() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { close } = useOnboardingCard();
  const auth = useAuth();
  const dispatch = useAppDispatch();

  const isLoggedIn = !!auth.session;

  function handleCreateAccount() {
    void auth.login(true).then((success) => {
      if (success) {
        // A new assistant is created when the account is created
        // Switch to it immediately
        void dispatch(selectFirstHubProfile());
        ideMessenger.post("showToast", ["info", "Account created!"]);
      }
    });
  }

  function handlePurchaseCredits() {
    ideMessenger.post("controlPlane/openUrl", {
      path: "settings/billing",
    });
    close();
  }

  function openPricingPage() {
    void ideMessenger.request("controlPlane/openUrl", {
      path: "pricing",
    });
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex flex-col items-center text-center">
        <h2 className="text-foreground mb-1 text-2xl font-semibold">
          Models Add-on
        </h2>

        <span className="text-description text-xs">
          Use a{" "}
          <span
            className="cursor-pointer underline hover:brightness-125"
            onClick={openPricingPage}
          >
            variety of frontier models
          </span>{" "}
          at cost.
        </span>
      </div>

      {/* Vertical step indicators */}
      <div className="flex w-full flex-col gap-4">
        {/* Step 1: Create Account */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1 ring-inset ${
                isLoggedIn
                  ? "bg-green-500 text-white ring-green-500"
                  : "text-foreground ring-foreground bg-transparent"
              }`}
            >
              {isLoggedIn ? <CheckIcon className="h-3 w-3" /> : "1"}
            </div>
            <span
              className={`text-sm ${isLoggedIn ? "text-description" : "text-foreground font-medium"}`}
            >
              Create Account
            </span>
          </div>
          <div className="flex gap-2">
            <div className="w-5 flex-shrink-0" />
            <Button
              onClick={handleCreateAccount}
              className="flex-1"
              disabled={isLoggedIn}
            >
              Create Account
            </Button>
          </div>
        </div>

        {/* Step 2: Purchase Credits */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1 ring-inset ${
                isLoggedIn
                  ? "text-foreground ring-foreground bg-transparent"
                  : "text-description ring-description bg-transparent"
              }`}
            >
              2
            </div>
            <span
              className={`text-sm ${isLoggedIn ? "text-foreground font-medium" : "text-description"}`}
            >
              Purchase Credits
            </span>
          </div>
          <div className="flex gap-2">
            <div className="w-5 flex-shrink-0" />
            <Button
              onClick={handlePurchaseCredits}
              className="flex-1"
              disabled={!isLoggedIn}
            >
              Purchase Credits
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
