import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ReactNode, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { vscBadgeForeground } from "../../..";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../redux/hooks";
import FreeTrialButton from "../../../FreeTrialButton";
import { ToolTip } from "../../../gui/Tooltip";
import { useFontSize } from "../../../ui/font";
import HoverItem from "../../InputToolbar/HoverItem";

import { usesFreeTrialApiKey } from "core/config/usesFreeTrialApiKey";
import type { FreeTrialStatus } from "core/control-plane/client";
import { getLocalStorage } from "../../../../util/localStorage";
import { CONFIG_ROUTES } from "../../../../util/navigation";
import { AssistantAndOrgListbox } from "../../../AssistantAndOrgListbox";

interface BlockSettingsToolbarIcon {
  title: string;
  tooltip: ReactNode;
  icon: React.ComponentType<any>;
  itemCount?: number;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
}

interface Section {
  id: string;
  title: string;
  tooltip: ReactNode;
  icon: React.ComponentType<any>;
}

const sections: Section[] = [
  {
    id: "error",
    title: "Errors",
    tooltip: "View errors",
    icon: ExclamationTriangleIcon,
  },
];

function BlockSettingsToolbarIcon(
  props: BlockSettingsToolbarIcon & { sectionId?: string },
) {
  const isErrorSection = props.sectionId === "error";

  const id = `block-settings-toolbar-icon-${props.sectionId}`;

  const fontSize = useFontSize(-3);
  return (
    <ToolTip delayShow={700} content={props.tooltip}>
      <div
        role="button"
        tabIndex={0}
        onClick={props.onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onClick();
          }
        }}
        data-testid={id}
        className={`${
          props.isSelected
            ? isErrorSection
              ? "bg-error"
              : "bg-badge"
            : undefined
        } relative flex cursor-pointer select-none items-center rounded-full px-1.5 py-1 sm:px-1.5 ${props.className || ""}`}
      >
        <props.icon
          className={`h-[13px] w-[13px] flex-shrink-0 ${
            isErrorSection ? "text-error" : ""
          }`}
          style={{
            color: props.isSelected ? vscBadgeForeground : undefined,
          }}
          aria-hidden="true"
        />
      </div>
    </ToolTip>
  );
}

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

  const errorSection = sections.find((section) => section.id === "error");
  const shouldShowError = configError && configError?.length > 0;

  return (
    <div className="flex flex-1 items-center justify-end gap-1.5">
      {shouldShowError && errorSection && (
        <BlockSettingsToolbarIcon
          sectionId={errorSection.id}
          icon={errorSection.icon}
          tooltip={errorSection.tooltip}
          title={errorSection.title}
          isSelected={false}
          onClick={() => navigate(CONFIG_ROUTES.AGENTS)}
        />
      )}
      <ToolTip
        place="top"
        content={isUsingFreeTrial ? "View free trial usage" : "Select Agent"}
      >
        <HoverItem
          data-tooltip-id="assistant-select-tooltip"
          className="!m-0 !p-0"
        >
          {isUsingFreeTrial ? (
            <FreeTrialButton freeTrialStatus={freeTrialStatus} />
          ) : (
            <AssistantAndOrgListbox variant="lump" />
          )}
        </HoverItem>
      </ToolTip>
    </div>
  );
}
