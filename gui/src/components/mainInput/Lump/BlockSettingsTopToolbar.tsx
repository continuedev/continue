import {
  BookOpenIcon,
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  CubeIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { ReactNode } from "react";
import { vscBadgeForeground } from "../..";
import { useAppSelector } from "../../../redux/hooks";
import { ToolTip } from "../../gui/Tooltip";
import AssistantSelect from "../../modelSelection/platform/AssistantSelect";
import { useFontSize } from "../../ui/font";
import HoverItem from "../InputToolbar/HoverItem";
import { useLump } from "./LumpContext";
import { ErrorsSectionTooltip } from "./sections/errors/ErrorsSectionTooltip";
import { McpSectionTooltip } from "./sections/mcp/MCPTooltip";
import { ToolsSectionTooltip } from "./sections/tool-policies/ToolPoliciesSectionTooltip";

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
  { id: "models", title: "Models", tooltip: "Models", icon: CubeIcon },
  { id: "rules", title: "Rules", tooltip: "Rules", icon: PencilIcon },
  { id: "docs", title: "Docs", tooltip: "Docs", icon: BookOpenIcon },
  {
    id: "prompts",
    title: "Prompts",
    tooltip: "Prompts",
    icon: ChatBubbleLeftIcon,
  },
  {
    id: "tools",
    title: "Tools",
    tooltip: <ToolsSectionTooltip />,
    icon: WrenchScrewdriverIcon,
  },
  {
    id: "mcp",
    title: "MCP",
    tooltip: <McpSectionTooltip />,
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
    <>
      <HoverItem
        px={0}
        onClick={props.onClick}
        data-testid={id}
        data-tooltip-id={id}
      >
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              props.onClick();
            }
          }}
          className={`${
            props.isSelected
              ? isErrorSection
                ? "bg-red-600"
                : "bg-badge"
              : undefined
          } relative flex select-none items-center rounded-full px-[3px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 sm:px-1 ${props.className || ""}`}
        >
          <props.icon
            className={`h-[13px] w-[13px] flex-shrink-0 hover:brightness-125 ${
              isErrorSection ? "text-red-600" : ""
            }`}
            style={{
              color: props.isSelected ? vscBadgeForeground : undefined,
            }}
            aria-hidden="true"
          />
          <div
            style={{ fontSize }}
            className={`overflow-hidden transition-all duration-200 ${
              props.isSelected ? "ml-1 w-auto opacity-100" : "w-0 opacity-0"
            }`}
          >
            <span
              className="whitespace-nowrap"
              style={{ color: vscBadgeForeground }}
            >
              {props.title}
            </span>
          </div>
        </div>
      </HoverItem>
      <ToolTip delayShow={700} id={id}>
        {props.tooltip}
      </ToolTip>
    </>
  );
}

export function BlockSettingsTopToolbar() {
  const {
    isToolbarExpanded,
    toggleToolbar,
    selectedSection,
    setSelectedSection,
  } = useLump();

  const configError = useAppSelector((store) => store.config.configError);

  const handleEllipsisClick = () => {
    if (isToolbarExpanded) {
      setSelectedSection(null);
    }
    toggleToolbar();
  };

  const visibleSections = sections.filter(
    (section) =>
      section.id !== "error" ||
      (section.id === "error" && configError && configError?.length > 0),
  );

  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <div className="flex flex-row">
        <div className="xs:flex hidden items-center justify-center text-gray-400">
          <BlockSettingsToolbarIcon
            className="-ml-1.5"
            icon={isToolbarExpanded ? ChevronLeftIcon : EllipsisHorizontalIcon}
            tooltip={isToolbarExpanded ? "Collapse Toolbar" : "Expand Toolbar"}
            title=""
            isSelected={false}
            onClick={handleEllipsisClick}
          />
          <div
            className={`${isToolbarExpanded ? "w-min" : "w-0"} flex overflow-hidden transition-all duration-200`}
          >
            <div className="flex">
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
        </div>
      </div>
      <div className="flex gap-0.5">
        <HoverItem
          data-tooltip-id="assistant-select-tooltip"
          className="!m-0 !p-0"
        >
          <AssistantSelect />
          <ToolTip id="assistant-select-tooltip" place="top">
            Select Assistant
          </ToolTip>
        </HoverItem>
      </div>
    </div>
  );
}
