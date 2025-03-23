import {
  BookOpenIcon,
  ChatBubbleLeftIcon,
  CubeIcon,
  PencilIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { vscBadgeBackground, vscBadgeForeground } from "../..";
import { fontSize } from "../../../util";
import AssistantSelect from "../../modelSelection/platform/AssistantSelect";
import HoverItem from "../InputToolbar/HoverItem";

interface BlockSettingsToolbarIcon {
  tooltip: string;
  icon: React.ComponentType<any>;
  itemCount?: number;
  onClick: () => void;
  isSelected?: boolean;
}

function BlockSettingsToolbarIcon(props: BlockSettingsToolbarIcon) {
  return (
    <HoverItem className="px-0" onClick={props.onClick}>
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
        className={`relative flex select-none items-center rounded-full px-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50`}
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
  return (
    <div className="flex w-full items-center justify-between">
      <div className="xs:flex hidden items-center justify-center text-gray-400">
        <BlockSettingsToolbarIcon
          icon={CubeIcon}
          tooltip="Models"
          isSelected={props.selectedSection === "models"}
          onClick={() =>
            props.setSelectedSection(
              props.selectedSection === "models" ? null : "models",
            )
          }
        />
        <BlockSettingsToolbarIcon
          icon={PencilIcon}
          tooltip="Rules"
          isSelected={props.selectedSection === "rules"}
          onClick={() =>
            props.setSelectedSection(
              props.selectedSection === "rules" ? null : "rules",
            )
          }
        />
        <BlockSettingsToolbarIcon
          icon={BookOpenIcon}
          tooltip="Docs"
          isSelected={props.selectedSection === "docs"}
          onClick={() =>
            props.setSelectedSection(
              props.selectedSection === "docs" ? null : "docs",
            )
          }
        />
        <BlockSettingsToolbarIcon
          icon={ChatBubbleLeftIcon}
          tooltip="Prompts"
          isSelected={props.selectedSection === "prompts"}
          onClick={() =>
            props.setSelectedSection(
              props.selectedSection === "prompts" ? null : "prompts",
            )
          }
        />
        {/* <TopToolbarIcon
          icon={FolderIcon}
          tooltip="Context"
          isSelected={props.selectedSection === "context"}
          onClick={() =>
            props.setSelectedSection(
              props.selectedSection === "context" ? null : "context",
            )
          }
        /> */}
        <BlockSettingsToolbarIcon
          icon={WrenchScrewdriverIcon}
          tooltip="Tools"
          isSelected={props.selectedSection === "tools"}
          onClick={() =>
            props.setSelectedSection(
              props.selectedSection === "tools" ? null : "tools",
            )
          }
        />
        <BlockSettingsToolbarIcon
          icon={Squares2X2Icon}
          tooltip="MCP"
          isSelected={props.selectedSection === "mcp"}
          onClick={() =>
            props.setSelectedSection(
              props.selectedSection === "mcp" ? null : "mcp",
            )
          }
        />
      </div>
      <div className="ml-auto">
        <AssistantSelect />
      </div>
    </div>
  );
}
