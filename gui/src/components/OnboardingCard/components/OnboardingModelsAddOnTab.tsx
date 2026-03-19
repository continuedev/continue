import { useContext } from "react";
import { Button } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useOnboardingCard } from "../hooks/useOnboardingCard";

/**
 * Models Add-On tab - directs users to configure their own models.
 */
export function OnboardingModelsAddOnTab() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { close } = useOnboardingCard();

  function handleConfigureModels() {
    ideMessenger.post("config/openProfile", {
      profileId: undefined,
    });
    close();
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex flex-col items-center text-center">
        <h2 className="text-foreground mb-1 text-2xl font-semibold">
          Models Add-on
        </h2>

        <span className="text-description text-xs">
          Configure your own model providers to get started.
        </span>
      </div>

      <div className="flex w-full flex-col gap-4">
        <div className="flex gap-2">
          <Button onClick={handleConfigureModels} className="flex-1">
            Configure Models
          </Button>
        </div>
      </div>
    </div>
  );
}
