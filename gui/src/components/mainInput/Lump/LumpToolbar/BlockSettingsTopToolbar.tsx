import {
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { ReactNode, useContext, useEffect, useState } from "react";
import { vscBadgeForeground } from "../../..";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../redux/hooks";
import FreeTrialButton from "../../../FreeTrialButton";
import { ToolTip } from "../../../gui/Tooltip";
import { useFontSize } from "../../../ui/font";
import HoverItem from "../../InputToolbar/HoverItem";
import { useLump } from "../LumpContext";
import { ErrorsSectionTooltip } from "../sections/errors/ErrorsSectionTooltip";

import { usesFreeTrialApiKey } from "core/config/usesFreeTrialApiKey";
import type { FreeTrialStatus } from "core/control-plane/client";
import { getLocalStorage } from "../../../../util/localStorage";
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
  { id: "rules", title: "Rules", tooltip: "Rules", icon: PencilIcon },
  {
    id: "prompts",
    title: "Prompts",
    tooltip: "Prompts",
    icon: ChatBubbleLeftIcon,
  },
  {
    id: "tools",
    title: "Tools",
    tooltip: "Tools",
    icon: WrenchScrewdriverIcon,
  },
  {
    id: "mcp",
    title: "MCP",
    tooltip: "MCP Servers",
    icon: Squares2X2Icon,
  },
  {
    id: "error",
    title: "Errors",
    tooltip: <ErrorsSectionTooltip />,
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
  const { selectedSection, setSelectedSection } = useLump();

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

  const visibleSections = sections.filter(
    (section) =>
      section.id !== "error" ||
      (section.id === "error" && configError && configError?.length > 0),
  );

  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <div className="flex flex-row">
        <div className="flex items-center justify-center gap-0.5">
          {visibleSections.map((section) => (
            <BlockSettingsToolbarIcon
              key={section.id}
              sectionId={section.id}
              icon={section.icon}
              tooltip={section.tooltip}
              title={section.title}
              isSelected={selectedSection === section.id}
              onClick={() =>
                setSelectedSection(
                  selectedSection === section.id ? null : section.id,
                )
              }
            />
          ))}
        </div>
      </div>
      <div className="flex gap-0.5">
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
              <AssistantAndOrgListbox />
            )}
          </HoverItem>
        </ToolTip>
      </div>
    </div>
  );
}
