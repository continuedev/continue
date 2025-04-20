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
import { vscBadgeForeground } from "../..";
import { useAppSelector } from "../../../redux/hooks";
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
  { id: "error", tooltip: "Errors", icon: ExclamationTriangleIcon },
];

function BlockSettingsToolbarIcon(
  props: BlockSettingsToolbarIcon & { sectionId?: string },
) {
  const isErrorSection = props.sectionId === "error";

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
        className={`${
          props.isSelected
            ? isErrorSection
              ? "bg-red-600"
              : "bg-badge"
            : undefined
        } relative flex select-none items-center rounded-full px-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${props.className || ""}`}
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
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex flex-row">
        <div className="xs:flex hidden items-center justify-center text-gray-400">
          <BlockSettingsToolbarIcon
            className="-ml-1.5"
            icon={isToolbarExpanded ? ChevronLeftIcon : EllipsisHorizontalIcon}
            tooltip={
              isToolbarExpanded ? "Collapse sections" : "Expand sections"
            }
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
      <div className="flex">
        <AssistantSelect />
      </div>
    </div>
  );
}
