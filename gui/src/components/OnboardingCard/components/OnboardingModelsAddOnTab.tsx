import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { Button } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getLocalStorage } from "../../../util/localStorage";
import { useOnboardingCard } from "../hooks/useOnboardingCard";

/**
 * Models Add-On tab component displaying pricing and tier information
 */
export function OnboardingModelsAddOnTab() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { close } = useOnboardingCard();
  const [isPolling, setIsPolling] = useState(false);

  const isJetbrains = getLocalStorage("ide") === "jetbrains";

  // Polling effect for JetBrains
  // This is because jetbrains doesn't support deeplinking the same way as VS Code
  useEffect(() => {
    if (!isPolling || !isJetbrains) return;

    const interval = setInterval(() => {
      ideMessenger.post("config/refreshProfiles", {
        reason: "Jetbrains onboarding polling",
        selectProfileId: "local",
      });
    }, 7000);

    return () => clearInterval(interval);
  }, [isPolling, isJetbrains, ideMessenger]);

  function openPricingPage() {
    ideMessenger.post("controlPlane/openUrl", {
      path: "pricing",
    });
  }
  <span className="text-sm">Discord</span>;
  async function handleUpgrade() {
    try {
      const response = await ideMessenger.request(
        "controlPlane/getModelsAddOnUpgradeUrl",
        {
          vsCodeUriScheme: getLocalStorage("vsCodeUriScheme"),
        },
      );

      if (response.status === "success" && response.content?.url) {
        await ideMessenger.request("openUrl", response.content.url);
      } else {
        console.error("Failed to get upgrade URL");
        openPricingPage();
      }
    } catch (error) {
      console.error("Error during upgrade process:", error);
      openPricingPage();
    } finally {
      if (isJetbrains) {
        setIsPolling(true);
      } else {
        close();
      }
    }
  }

  // Show polling UI for JetBrains after upgrade
  if (isPolling && isJetbrains) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <h2 className="text-foreground mb-4 items-center text-lg font-semibold">
          <ArrowPathIcon className="text-foreground animate-spin-slow mr-2 h-4 w-4" />
          You may close this dialog after upgrading
        </h2>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex flex-col items-center text-center">
        <div className="mb-1">
          <h2 className="text-foreground mb-1 text-2xl font-semibold">
            Models Add-on
          </h2>
        </div>

        <span className="text-description text-base">
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

      <div className="w-full">
        <Button onClick={handleUpgrade} className="w-full max-w-xs">
          Upgrade
        </Button>
      </div>
      <div className="w-full text-center">
        <span className="text-description">
          <span
            className="cursor-pointer underline hover:brightness-125"
            onClick={openPricingPage}
          >
            Click here
          </span>{" "}
          to view pricing details
        </span>
      </div>
    </div>
  );
}
