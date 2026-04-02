import { CreditCardIcon, KeyIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { GhostButton, SecondaryButton } from "../../components";
import { IdeMessengerContext } from "../../context/IdeMessenger";

const ANTHROPIC_SECRET_URL =
  "https://hub.continue.dev/settings/secrets?secretName=ANTHROPIC_API_KEY";

export function OutOfCreditsDialog() {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className={`flex flex-col gap-1 px-3 pb-2 pt-3`}>
      <p className="m-0 p-0 text-lg">
        You have no credits remaining on your Continue account
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        <span>
          To purchase more or set up auto top-up, click below to visit the
          billing page:
        </span>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <SecondaryButton
            className="flex flex-row items-center gap-2 hover:opacity-70"
            onClick={() => {
              ideMessenger.post("controlPlane/openUrl", {
                path: "/settings/billing",
              });
            }}
          >
            <CreditCardIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Purchase Credits</span>
          </SecondaryButton>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 border-t border-zinc-700 pt-3">
        <span className="text-sm text-zinc-400">
          Alternatively, use your own API key by switching to the{" "}
          <code>anthropic</code> provider in your config, then add your key as a
          secret:
        </span>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <GhostButton
            className="flex flex-row items-center gap-2"
            onClick={() => {
              ideMessenger.post("openUrl", ANTHROPIC_SECRET_URL);
            }}
          >
            <KeyIcon className="h-4 w-4" />
            <span>Add API key secret</span>
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
