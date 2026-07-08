import { XMarkIcon } from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { vscButtonBackground, vscButtonForeground } from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { varWithFallback } from "../styles/theme";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";

const EXPIRATION_DATE = new Date("2026-09-09");
const EXPORT_URL = "https://continue.dev/export";
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
    <div className="px-4 py-4">
      <div
        className="border-info relative rounded-md border-[0.5px] border-solid px-3 py-2.5 shadow-sm"
        style={{
          backgroundColor: `color-mix(in srgb, ${varWithFallback("info")} 20%, transparent)`,
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
        <div className="flex flex-col gap-1.5 text-xs">
          <p className={dismissable ? "pr-5" : ""}>
            Extension configuration is local only as of v2.0.0
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => ideMessenger.post("openUrl", REPO_URL)}
              className="border-description text-foreground flex-1 cursor-pointer rounded border-[0.5px] border-solid bg-transparent px-2 py-1 text-[11px] font-medium hover:brightness-125"
            >
              Learn more
            </button>
            <button
              onClick={() => ideMessenger.post("openUrl", EXPORT_URL)}
              className="flex-1 cursor-pointer rounded border-none px-2 py-1 text-[11px] font-medium hover:brightness-125"
              style={{
                backgroundColor: vscButtonBackground,
                color: vscButtonForeground,
              }}
            >
              Export cloud configs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
