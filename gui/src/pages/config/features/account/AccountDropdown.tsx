import {
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useContext, useEffect, useState } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../../components/ui";
import { Divider } from "../../../../components/ui/Divider";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";

interface FreeTrialStatus {
  optedInToFreeTrial: boolean;
  chatCount?: number;
  autocompleteCount?: number;
  chatLimit: number;
  autocompleteLimit: number;
}

export function AccountDropdown() {
  const { session, logout } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const [freeTrialStatus, setFreeTrialStatus] =
    useState<FreeTrialStatus | null>(null);

  useEffect(() => {
    const fetchFreeTrialStatus = async () => {
      if (session && !isOnPremSession(session)) {
        try {
          const response = await ideMessenger.request(
            "controlPlane/getFreeTrialStatus",
            undefined,
          );
          if (response.status === "success") {
            setFreeTrialStatus(response.content);
          } else {
            console.error("Failed to fetch free trial status:", response.error);
          }
        } catch (error) {
          console.error("Failed to fetch free trial status:", error);
        }
      }
    };

    void fetchFreeTrialStatus();
  }, [session, ideMessenger]);

  const getUpgradeInfo = () => {
    if (!freeTrialStatus) {
      return {
        title: "Upgrade to Pro",
        description:
          "Get everything in Hobby, plus unlimited completions, MAX Mode, and more",
      };
    }

    if (freeTrialStatus.optedInToFreeTrial) {
      const chatUsed = freeTrialStatus.chatCount ?? 0;
      const chatLimit = freeTrialStatus.chatLimit;
      const isNearLimit = chatUsed / chatLimit > 0.8;

      if (isNearLimit) {
        return {
          title: "Upgrade to Models Add-On",
          description: `You've used ${chatUsed}/${chatLimit} free trial requests. Upgrade for unlimited usage`,
        };
      } else {
        return {
          title: "Upgrade to Models Add-On",
          description:
            "Get unlimited chat requests and autocomplete suggestions",
        };
      }
    }

    return {
      title: "Upgrade to Pro",
      description:
        "Get everything in Hobby, plus unlimited completions, MAX Mode, and more",
    };
  };

  if (!session || isOnPremSession(session)) {
    return null;
  }

  return (
    <div>
      <Listbox>
        {({ open }) => (
          <>
            <ListboxButton
              className={`text-description w-full justify-start gap-1 border-none px-2 py-1.5 ${
                open
                  ? "bg-vsc-input-background"
                  : "hover:bg-vsc-input-background bg-inherit"
              }`}
            >
              <UserCircleIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
              <div className="ml-1 flex min-w-0 flex-1 flex-col items-start overflow-hidden">
                <span className="w-full truncate text-xs font-medium hover:brightness-110">
                  {session.account.label}
                </span>
                <span className="text-description-muted w-full truncate text-xs">
                  {session.account.id}
                </span>
              </div>
            </ListboxButton>
            <ListboxOptions anchor="right end">
              {/* Account info section for small screens */}
              <div className="md:hidden">
                <div className="flex items-center gap-2 px-2 py-1">
                  <UserCircleIcon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium">
                      {session.account.label}
                    </span>
                    <span className="text-description-muted truncate text-xs">
                      {session.account.id}
                    </span>
                  </div>
                </div>
                <Divider />
              </div>

              <ListboxOption
                onClick={() =>
                  ideMessenger.post(
                    "openUrl",
                    "https://hub.continue.dev/settings",
                  )
                }
                value="manage-account"
              >
                <div className="flex items-center gap-2 py-0.5">
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                  <span>Manage Account</span>
                </div>
              </ListboxOption>

              <ListboxOption onClick={logout} value="logout">
                <div className="flex items-center gap-2 py-0.5">
                  <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </div>
              </ListboxOption>
            </ListboxOptions>
          </>
        )}
      </Listbox>
    </div>
  );
}
