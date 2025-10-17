import { GiftIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
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

  const ideMessenger = useContext(IdeMessengerContext);

  const pendingToolCalls = useAppSelector(selectPendingToolCalls);
  const callingToolCalls = useAppSelector((state) =>
    selectToolCallsByStatus(state, "calling"),
  );
  const hasActiveContent =
    pendingToolCalls.length > 0 || callingToolCalls.length > 0;

  const { creditStatus, isUsingFreeTrial, refreshCreditStatus } =
    useCreditStatus();

  const handleToolsClick = () => {
    if (selectedProfile) {
      dispatch(setSelectedProfile(selectedProfile.id));
      ideMessenger.post("didChangeSelectedProfile", {
        id: selectedProfile.id,
      });
    }
    navigate(CONFIG_ROUTES.TOOLS);
  };

  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <div className="flex items-center gap-1">
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

            <ToolTip content="Configure tools">
              <HoverItem onClick={handleToolsClick} px={2}>
                <WrenchScrewdriverIcon className="text-description-muted h-3 w-3 hover:brightness-125" />
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
