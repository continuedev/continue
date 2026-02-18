import {
  ArrowPathIcon,
  GiftIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CreditStatus } from "core/control-plane/client";
import { useContext, useState } from "react";
import { Button, SecondaryButton, vscButtonBackground } from ".";
import { useAuth } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { cn } from "../util/cn";
import { setLocalStorage } from "../util/localStorage";
import { ToolbarButtonWithTooltip } from "./StyledMarkdownPreview/StepContainerPreToolbar/ToolbarButtonWithTooltip";
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
          ${(current / 100).toFixed(2)} / ${(total / 100).toFixed(2)}
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

interface CreditStatusProgressBarsProps {
  creditStatus: CreditStatus;
}

function CreditStatusProgressBar({
  creditStatus,
}: CreditStatusProgressBarsProps) {
  const total = 50;
  const usage = total - (creditStatus.creditBalance ?? 0);

  return (
    <ProgressBar label="Starter credits usage" current={usage} total={total} />
  );
}

interface StarterCreditsPopoverProps {
  creditStatus?: CreditStatus | null;
  refreshCreditStatus?: () => Promise<void>;
  children: React.ReactNode;
}

export default function StarterCreditsPopover({
  creditStatus,
  refreshCreditStatus,
  children,
}: StarterCreditsPopoverProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { refreshProfiles } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onSetupApiKeys = async () => {
    await ideMessenger.request("controlPlane/openUrl", {
      path: "setup-models/api-keys",
      orgSlug: undefined,
    });
  };

  const onPurchaseCredits = async () => {
    await ideMessenger.request("controlPlane/openUrl", {
      path: "settings/billing",
      orgSlug: undefined,
    });
  };

  const onHideStarterCreditsUsage = async () => {
    // At this point the user doesn't want to see the credit usage UI, so we make sure this is gone right away
    setLocalStorage("hasExitedFreeTrial", true);
  };

  const onRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    const refreshCalls: Promise<unknown>[] = [
      refreshProfiles("Manual refresh from starter credits button"),
    ];

    if (refreshCreditStatus) {
      refreshCalls.push(refreshCreditStatus());
    }

    try {
      await Promise.all(refreshCalls);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Listbox>
      <ListboxButton
        as="span"
        className="!m-0 !flex-none !gap-0 !border-none !bg-transparent !p-0"
      >
        {children}
      </ListboxButton>

      <Transition>
        <ListboxOptions className="pb-0">
          <div className="relative max-w-96 px-4 pb-4">
            <div className="flex items-center gap-2">
              <GiftIcon className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Starter credits</h3>
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1">
              <ToolbarButtonWithTooltip
                onClick={() => {
                  void onRefresh();
                }}
                tooltipContent="Refresh credit usage"
              >
                <ArrowPathIcon
                  className={cn("h-3 w-3", isRefreshing && "animate-spin-slow")}
                />
              </ToolbarButtonWithTooltip>
              <ToolbarButtonWithTooltip
                onClick={onHideStarterCreditsUsage}
                tooltipContent="Hide starter credits usage"
              >
                <XMarkIcon className="h-3 w-3" />
              </ToolbarButtonWithTooltip>
            </div>

            <div className="mb-4">
              <span className="text-description">
                You are currently using starter credits for Continue, which
                allows you to use a variety of frontier models at cost. Read
                more{" "}
                <span
                  onClick={async () => {
                    await ideMessenger.request("controlPlane/openUrl", {
                      path: "pricing",
                      orgSlug: undefined,
                    });
                    ``;
                  }}
                  className="cursor-pointer text-blue-400 underline hover:text-blue-300"
                >
                  here
                </span>
                .
              </span>
            </div>

            {!creditStatus ? (
              <div className="mb-4 flex items-center justify-center py-8">
                <span className="text-description">
                  Loading credit usage...
                </span>
              </div>
            ) : (
              <CreditStatusProgressBar creditStatus={creditStatus} />
            )}

            <div className="mt-4 flex gap-2">
              <SecondaryButton className="flex-1" onClick={onSetupApiKeys}>
                Setup API Keys
              </SecondaryButton>
              <Button className="flex-1" onClick={onPurchaseCredits}>
                Purchase Credits
              </Button>
            </div>
          </div>
        </ListboxOptions>
      </Transition>
    </Listbox>
  );
}
