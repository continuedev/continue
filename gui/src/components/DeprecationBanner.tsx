import { XMarkIcon } from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { varWithFallback } from "../styles/theme";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";

const EXPIRATION_DATE = new Date("2026-05-09");
const EXPORT_URL = "https://continue.dev/settings/export";
const REPO_URL = "https://github.com/continuedev/continue/blob/main/README.md";

interface DeprecationBannerProps {
  dismissable?: boolean;
}

export function DeprecationBanner({
  dismissable = true,
}: DeprecationBannerProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [dismissed, setDismissed] = useState(
    () => getLocalStorage("hasDismissedDeprecationBanner") ?? false,
  );

  if (Date.now() > EXPIRATION_DATE.getTime()) {
    return null;
  }

  if (dismissable && dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    setLocalStorage("hasDismissedDeprecationBanner", true);
  };

  return (
    <div className="px-4 pt-4">
      <div
        className="border-warning relative rounded-md border-[0.5px] border-solid px-3 py-2.5 shadow-sm"
        style={{
          backgroundColor: `color-mix(in srgb, ${varWithFallback("warning")} 20%, transparent)`,
        }}
      >
        {dismissable && (
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-2 border-none bg-transparent p-0.5 text-gray-400 hover:brightness-125"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex flex-col gap-2.5 text-xs">
          <p className={dismissable ? "pr-5" : ""}>
            Continue is entering maintenance mode.{" "}
            <span
              onClick={() => ideMessenger.post("openUrl", REPO_URL)}
              className="cursor-pointer underline hover:brightness-125"
            >
              Learn more here
            </span>
          </p>
          <button
            onClick={() => ideMessenger.post("openUrl", EXPORT_URL)}
            className="border-description text-foreground w-full rounded border-[0.5px] border-solid bg-transparent px-3 py-1.5 text-xs font-medium hover:brightness-125"
          >
            Download your Hub configurations
          </button>
        </div>
      </div>
    </div>
  );
}
