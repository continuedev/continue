import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../redux/hooks";
import FreeTrialButton from "../../../FreeTrialButton";
import { ToolTip } from "../../../gui/Tooltip";

import { usesFreeTrialApiKey } from "core/config/usesFreeTrialApiKey";
import type { FreeTrialStatus } from "core/control-plane/client";
import { getLocalStorage } from "../../../../util/localStorage";
import { CONFIG_ROUTES } from "../../../../util/navigation";
import { AssistantAndOrgListbox } from "../../../AssistantAndOrgListbox";

export function BlockSettingsTopToolbar() {
  const navigate = useNavigate();

  const configError = useAppSelector((store) => store.config.configError);
  const config = useAppSelector((state) => state.config.config);
  const ideMessenger = useContext(IdeMessengerContext);

  const [freeTrialStatus, setFreeTrialStatus] =
    useState<FreeTrialStatus | null>(null);
  const hasExitedFreeTrial = getLocalStorage("hasExitedFreeTrial");
  const isUsingFreeTrial = usesFreeTrialApiKey(config) && !hasExitedFreeTrial;

  useEffect(() => {
    const fetchFreeTrialStatus = () => {
      ideMessenger
        .request("controlPlane/getFreeTrialStatus", undefined)
        .then((resp) => {
          if (resp.status === "success") {
            setFreeTrialStatus(resp.content);
          }
        })
        .catch(() => {});
    };

    fetchFreeTrialStatus();

    let intervalId: NodeJS.Timeout | null = null;

    if (isUsingFreeTrial) {
      intervalId = setInterval(fetchFreeTrialStatus, 15000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [ideMessenger, isUsingFreeTrial]);

  const shouldShowError = configError && configError?.length > 0;

  return (
    <div className="flex flex-1 items-center justify-between gap-1.5">
      <div>
        {shouldShowError && (
          <ToolTip delayShow={700} content="View configuration errors">
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(CONFIG_ROUTES.AGENTS)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(CONFIG_ROUTES.AGENTS);
                }
              }}
              data-testid="block-settings-toolbar-icon-error"
              className="relative flex cursor-pointer select-none items-center rounded-full px-1.5 py-1 sm:px-1.5"
            >
              <ExclamationTriangleIcon
                className="text-warning h-[13px] w-[13px] flex-shrink-0"
                aria-hidden="true"
              />
            </div>
          </ToolTip>
        )}
      </div>
      <ToolTip
        place="top"
        content={isUsingFreeTrial ? "View free trial usage" : "Select Agent"}
      >
        <div>
          {isUsingFreeTrial ? (
            <FreeTrialButton freeTrialStatus={freeTrialStatus} />
          ) : (
            <AssistantAndOrgListbox variant="lump" />
          )}
        </div>
      </ToolTip>
    </div>
  );
}
