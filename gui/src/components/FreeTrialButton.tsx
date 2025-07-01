import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { FreeTrialStatus } from "core/control-plane/client";
import { useContext } from "react";
import { Button, SecondaryButton, vscButtonBackground } from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { fontSize } from "../util";
import { setLocalStorage } from "../util/localStorage";
import { Listbox, ListboxButton, ListboxOptions, Transition } from "./ui";

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
}

function ProgressBar({ label, current, total }: ProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100);

  return (
    <div className="mb-4">
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-700">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: vscButtonBackground,
          }}
        />
      </div>
    </div>
  );
}

interface FreeTrialProgressBarsProps {
  freeTrialStatus: FreeTrialStatus;
}

function FreeTrialProgressBars({
  freeTrialStatus,
}: FreeTrialProgressBarsProps) {
  // Use data from freeTrialStatus
  const autocompleteUsage = {
    current: freeTrialStatus.autocompleteCount,
    total: freeTrialStatus.autocompleteLimit,
  };
  const chatUsage = {
    current: freeTrialStatus.chatCount,
    total: freeTrialStatus.chatLimit,
  };

  return (
    <>
      <ProgressBar
        label="Autocomplete usage"
        current={autocompleteUsage.current ?? 0}
        total={autocompleteUsage.total}
      />

      <ProgressBar
        label="Chat usage"
        current={chatUsage.current ?? 0}
        total={chatUsage.total}
      />
    </>
  );
}

interface FreeTrialButtonProps {
  freeTrialStatus?: FreeTrialStatus | null;
}

export default function FreeTrialButton({
  freeTrialStatus,
}: FreeTrialButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const onExitFreeTrial = async () => {
    setLocalStorage("hasExitedFreeTrial", true);

    await ideMessenger.request("controlPlane/openUrl", {
      path: "setup-models",
      orgSlug: undefined,
    });
  };

  return (
    <Listbox>
      <div className="relative">
        <ListboxButton
          className="text-description border-none bg-transparent hover:brightness-125"
          style={{ fontSize: fontSize(-3) }}
        >
          <div className="flex flex-row items-center gap-1.5">
            <span className="line-clamp-1 select-none">Free trial usage</span>
          </div>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0 select-none"
            aria-hidden="true"
          />
        </ListboxButton>

        <Transition>
          <ListboxOptions className="pb-0">
            <div className="max-w-96 px-4 pb-4">
              <h3 className="mb-4 text-sm font-semibold">
                Free trial of the Models Add-On
              </h3>

              <div className="mb-4">
                <span className="text-description">
                  You are currently using a free trial the Models Add-On, which
                  allows you to use a variety of frontier models for a flat
                  monthly fee. Read more about usage limits and what models are
                  included{" "}
                  <span
                    onClick={async () => {
                      await ideMessenger.request("controlPlane/openUrl", {
                        path: "pricing",
                        orgSlug: undefined,
                      });
                    }}
                    className="cursor-pointer text-blue-400 underline hover:text-blue-300"
                  >
                    here
                  </span>
                  .
                </span>
              </div>

              {!freeTrialStatus ? (
                <div className="mb-4 flex items-center justify-center py-8">
                  <span className="text-description">
                    Loading trial usage...
                  </span>
                </div>
              ) : (
                <FreeTrialProgressBars freeTrialStatus={freeTrialStatus} />
              )}

              <div className="mt-4 flex gap-2">
                <SecondaryButton className="flex-1" onClick={onExitFreeTrial}>
                  Exit trial
                </SecondaryButton>
                <Button
                  className="flex-1"
                  onClick={async () => {
                    await ideMessenger.request("controlPlane/openUrl", {
                      path: "settings/billing",
                      orgSlug: undefined,
                    });
                  }}
                >
                  Upgrade
                </Button>
              </div>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
