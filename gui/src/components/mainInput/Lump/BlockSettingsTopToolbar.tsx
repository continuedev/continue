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
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { toggleBlockSettingsToolbar } from "../../../redux/slices/uiSlice";
import { fontSize } from "../../../util";
import AssistantSelect from "../../modelSelection/platform/AssistantSelect";
import HoverItem from "../InputToolbar/bottom/HoverItem";

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
          className="h-3 w-3 hover:brightness-125"
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

interface BlockSettingsTopToolbarProps {
  selectedSection: string | null;
  setSelectedSection: (value: string | null) => void;
}

export function BlockSettingsTopToolbar(props: BlockSettingsTopToolbarProps) {
  const isExpanded = useAppSelector(
    (state) => state.ui.isBlockSettingsToolbarExpanded,
  );
  const dispatch = useAppDispatch();
  const handleEllipsisClick = () => {
    if (isExpanded) {
      props.setSelectedSection(null);
    }
    dispatch(toggleBlockSettingsToolbar());
  };

  return (
    <div className="flex w-full items-center justify-between">
      <div className="xs:flex hidden items-center justify-center text-gray-400">
        <BlockSettingsToolbarIcon
          icon={isExpanded ? ChevronLeftIcon : EllipsisHorizontalIcon}
          tooltip={isExpanded ? "Collapse sections" : "Expand sections"}
          isSelected={false}
          onClick={handleEllipsisClick}
        />
        <div
          className="flex overflow-hidden transition-all duration-200"
          style={{ width: isExpanded ? `160px` : "0px" }}
        >
          <div className="flex">
            {sections.map((section) => (
              <BlockSettingsToolbarIcon
                key={section.id}
                icon={section.icon}
                tooltip={section.tooltip}
                isSelected={props.selectedSection === section.id}
                onClick={() =>
                  props.setSelectedSection(
                    props.selectedSection === section.id ? null : section.id,
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="ml-auto">
        <AssistantSelect />
      </div>
      <AssistantSelect />
    </div>
  );
}
