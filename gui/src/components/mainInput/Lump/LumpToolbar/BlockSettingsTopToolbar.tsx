import {
  CubeIcon,
  ExclamationTriangleIcon,
  GiftIcon,
  PencilIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import {
  selectPendingToolCalls,
  selectToolCallsByStatus,
} from "../../../../redux/selectors/selectToolCalls";
import { setSelectedProfile } from "../../../../redux/slices/profilesSlice";
import StarterCreditsPopover from "../../../StarterCreditsPopover";
import { ToolTip } from "../../../gui/Tooltip";
import HoverItem from "../../InputToolbar/HoverItem";

import { useAuth } from "../../../../context/Auth";
import { useCreditStatus } from "../../../../hooks/useCredits";
import { CONFIG_ROUTES } from "../../../../util/navigation";
import { AssistantAndOrgListbox } from "../../../AssistantAndOrgListbox";

export function BlockSettingsTopToolbar() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { selectedProfile } = useAuth();

  const configError = useAppSelector((store) => store.config.configError);
  const ideMessenger = useContext(IdeMessengerContext);

  const pendingToolCalls = useAppSelector(selectPendingToolCalls);
  const callingToolCalls = useAppSelector((state) =>
    selectToolCallsByStatus(state, "calling"),
  );
  const hasActiveContent =
    pendingToolCalls.length > 0 || callingToolCalls.length > 0;

  const shouldShowError = configError && configError?.length > 0;

  const { creditStatus, isUsingFreeTrial, refreshCreditStatus } =
    useCreditStatus();

  const handleRulesClick = () => {
    if (selectedProfile) {
      dispatch(setSelectedProfile(selectedProfile.id));
      ideMessenger.post("didChangeSelectedProfile", {
        id: selectedProfile.id,
      });
    }
    navigate(CONFIG_ROUTES.RULES);
  };

  const handleToolsClick = () => {
    if (selectedProfile) {
      dispatch(setSelectedProfile(selectedProfile.id));
      ideMessenger.post("didChangeSelectedProfile", {
        id: selectedProfile.id,
      });
    }
    navigate(CONFIG_ROUTES.TOOLS);
  };

  const handleModelsClick = () => {
    if (selectedProfile) {
      dispatch(setSelectedProfile(selectedProfile.id));
      ideMessenger.post("didChangeSelectedProfile", {
        id: selectedProfile.id,
      });
    }
    navigate(CONFIG_ROUTES.MODELS);
  };

  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        {shouldShowError && (
          <ToolTip delayShow={700} content="View configuration errors">
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(CONFIG_ROUTES.CONFIGS)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(CONFIG_ROUTES.CONFIGS);
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

        {!hasActiveContent && (
          <div className="flex items-center gap-1.5">
            {isUsingFreeTrial && (
              <ToolTip content="View remaining starter credits">
                <StarterCreditsPopover
                  creditStatus={creditStatus}
                  refreshCreditStatus={refreshCreditStatus}
                >
                  <HoverItem px={2}>
                    <GiftIcon className="text-description-muted h-3 w-3 hover:brightness-125" />
                  </HoverItem>
                </StarterCreditsPopover>
              </ToolTip>
            )}

            <ToolTip content="Configure rules">
              <HoverItem onClick={handleRulesClick} px={2}>
                <PencilIcon className="text-description-muted h-3 w-3 hover:brightness-125" />
              </HoverItem>
            </ToolTip>

            <ToolTip content="Configure tools">
              <HoverItem onClick={handleToolsClick} px={2}>
                <WrenchScrewdriverIcon className="text-description-muted h-3 w-3 hover:brightness-125" />
              </HoverItem>
            </ToolTip>

            <ToolTip content="Configure models">
              <HoverItem onClick={handleModelsClick} px={2}>
                <CubeIcon className="text-description-muted h-3 w-3 hover:brightness-125" />
              </HoverItem>
            </ToolTip>
          </div>
        )}
      </div>

      <ToolTip place="top" content="Select Config">
        <div>
          <AssistantAndOrgListbox variant="lump" />
        </div>
      </ToolTip>
    </div>
  );
}
