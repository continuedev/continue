import {
  BookOpenIcon,
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  CubeIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { vscBadgeBackground, vscBadgeForeground } from "../..";
import { fontSize } from "../../../util";
import AssistantSelect from "../../modelSelection/platform/AssistantSelect";
import HoverItem from "../InputToolbar/HoverItem";
import { useLump } from "./LumpContext";

interface BlockSettingsToolbarIcon {
  tooltip: string;
  icon: React.ComponentType<any>;
  itemCount?: number;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
}

interface Section {
  id: string;
  tooltip: string;
  icon: React.ComponentType<any>;
}

const sections: Section[] = [
  { id: "models", tooltip: "Models", icon: CubeIcon },
  { id: "rules", tooltip: "Rules", icon: PencilIcon },
  { id: "docs", tooltip: "Docs", icon: BookOpenIcon },
  { id: "prompts", tooltip: "Prompts", icon: ChatBubbleLeftIcon },
  { id: "tools", tooltip: "Tools", icon: WrenchScrewdriverIcon },
  { id: "mcp", tooltip: "MCP", icon: Squares2X2Icon },
];

function BlockSettingsToolbarIcon(props: BlockSettingsToolbarIcon) {
  return (
    <HoverItem px={0} onClick={props.onClick}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onClick();
          }
        }}
        style={{
          backgroundColor: props.isSelected ? vscBadgeBackground : undefined,
        }}
        className={`relative flex select-none items-center rounded-full px-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${props.className || ""}`}
      >
        <props.icon
          className="h-[13px] w-[13px] flex-shrink-0 hover:brightness-125"
          style={{
            color: props.isSelected ? vscBadgeForeground : undefined,
          }}
          aria-hidden="true"
        />
        <div
          style={{ fontSize: fontSize(-3) }}
          className={`overflow-hidden transition-all duration-200 ${
            props.isSelected ? "ml-1 w-auto opacity-100" : "w-0 opacity-0"
          }`}
        >
          <span
            className="whitespace-nowrap"
            style={{ color: vscBadgeForeground }}
          >
            {props.tooltip}
          </span>
        </div>
      </div>
    </HoverItem>
  );
}

export function BlockSettingsTopToolbar() {
  const {
    isToolbarExpanded,
    toggleToolbar,
    selectedSection,
    setSelectedSection,
  } = useLump();

  const handleEllipsisClick = () => {
    if (isToolbarExpanded) {
      setSelectedSection(null);
    }
    toggleToolbar();
  };

  return (
    <div className="flex w-full items-center justify-between">
      <div className="xs:flex hidden items-center justify-center text-gray-400">
        <BlockSettingsToolbarIcon
          className="-ml-1.5"
          icon={isToolbarExpanded ? ChevronLeftIcon : EllipsisHorizontalIcon}
          tooltip={isToolbarExpanded ? "Collapse sections" : "Expand sections"}
          isSelected={false}
          onClick={handleEllipsisClick}
        />
        <div
          className="flex overflow-hidden transition-all duration-200"
          style={{ width: isToolbarExpanded ? `160px` : "0px" }}
        >
          <div className="flex">
            {sections.map((section) => (
              <BlockSettingsToolbarIcon
                key={section.id}
                icon={section.icon}
                tooltip={section.tooltip}
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
      <div>
        <AssistantSelect />
      </div>
    </div>
  );
}
