import {
  CubeIcon,
  ExclamationTriangleIcon,
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
import { ToolTip } from "../../../gui/Tooltip";
import HoverItem from "../../InputToolbar/HoverItem";

import { useAuth } from "../../../../context/Auth";
import { CONFIG_ROUTES } from "../../../../util/navigation";
import { AssistantAndOrgListbox } from "../../../AssistantAndOrgListbox";
import { MissingSecretsPopover } from "../../../config/MissingSecretsPopover";
import {
  missingSecretsFromErrors,
  missingSecretSummary,
  otherErrors,
} from "../../../../util/missingSecrets";

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

  const missingSecrets = missingSecretsFromErrors(configError);
  const otherConfigErrors = otherErrors(configError);
  // Only a missing key is wrong: say which one, and offer the fix right here.
  // Any other error keeps today's behaviour (open the Configs tab).
  const onlyMissingSecrets =
    missingSecrets.length > 0 && otherConfigErrors.length === 0;

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
        {shouldShowError && onlyMissingSecrets && (
          <ToolTip
            delayShow={700}
            content={missingSecretSummary(missingSecrets)}
          >
            <div data-testid="block-settings-toolbar-icon-missing-secret">
              <MissingSecretsPopover
                missing={missingSecrets}
                ariaLabel={missingSecretSummary(missingSecrets)}
                buttonTestId="block-settings-toolbar-icon-error"
                className="flex items-center rounded-full px-1.5 py-1 sm:px-1.5"
              >
                <ExclamationTriangleIcon
                  className="h-[13px] w-[13px] flex-shrink-0 text-warning"
                  aria-hidden="true"
                />
              </MissingSecretsPopover>
            </div>
          </ToolTip>
        )}

        {shouldShowError && !onlyMissingSecrets && (
          <ToolTip
            delayShow={700}
            content={
              missingSecrets.length > 0
                ? `${missingSecretSummary(missingSecrets)}. View configuration errors`
                : "View configuration errors"
            }
          >
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
                className="h-[13px] w-[13px] flex-shrink-0 text-warning"
                aria-hidden="true"
              />
            </div>
          </ToolTip>
        )}

        {!hasActiveContent && (
          <div className="flex items-center gap-1.5">
            <ToolTip content="Configure rules">
              <HoverItem onClick={handleRulesClick} px={2}>
                <PencilIcon className="h-3 w-3 text-description-muted hover:brightness-125" />
              </HoverItem>
            </ToolTip>

            <ToolTip content="Configure tools">
              <HoverItem onClick={handleToolsClick} px={2}>
                <WrenchScrewdriverIcon className="h-3 w-3 text-description-muted hover:brightness-125" />
              </HoverItem>
            </ToolTip>

            <ToolTip content="Configure models">
              <HoverItem onClick={handleModelsClick} px={2}>
                <CubeIcon className="h-3 w-3 text-description-muted hover:brightness-125" />
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
