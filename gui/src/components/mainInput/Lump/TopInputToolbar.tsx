import {
  BookOpenIcon,
  ChatBubbleLeftIcon,
  CubeIcon,
  FolderIcon,
  PencilIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { vscBadgeBackground, vscBadgeForeground } from "../..";
import { getFontSize } from "../../../util";
import AssistantSelect from "../../modelSelection/platform/AssistantSelect";
import HoverItem from "../InputToolbar/HoverItem";

interface TopToolbarIconProps {
  tooltip: string;
  icon: React.ComponentType<any>;
  itemCount?: number;
  onClick: () => void;
  isSelected?: boolean;
}

function TopToolbarIcon(props: TopToolbarIconProps) {
  return (
    <HoverItem onClick={props.onClick}>
      <div
        style={{
          backgroundColor: props.isSelected ? vscBadgeBackground : undefined,
        }}
        className={`relative flex select-none items-center px-0.5 transition-all duration-200 ${
          props.isSelected ? "rounded-full" : ""
        }`}
      >
        <props.icon
          className="h-3 w-3 hover:brightness-125"
          style={{
            color: props.isSelected ? vscBadgeForeground : undefined,
          }}
        />
        <div
          style={{ fontSize: `${getFontSize() - 3}px` }}
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

interface TopInputProps {
  selectedSection: string | null;
  setSelectedSection: (value: string | null) => void;
}

export function TopInputToolbar(props: TopInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center text-gray-400">
          <TopToolbarIcon
            icon={CubeIcon}
            tooltip="Models"
            isSelected={props.selectedSection === "models"}
            onClick={() =>
              props.setSelectedSection(
                props.selectedSection === "models" ? null : "models",
              )
            }
          />
          <TopToolbarIcon
            icon={PencilIcon}
            tooltip="Rules"
            isSelected={props.selectedSection === "rules"}
            onClick={() =>
              props.setSelectedSection(
                props.selectedSection === "rules" ? null : "rules",
              )
            }
          />
          <TopToolbarIcon
            icon={BookOpenIcon}
            tooltip="Docs"
            isSelected={props.selectedSection === "docs"}
            onClick={() =>
              props.setSelectedSection(
                props.selectedSection === "docs" ? null : "docs",
              )
            }
          />
          <TopToolbarIcon
            icon={ChatBubbleLeftIcon}
            tooltip="Prompts"
            isSelected={props.selectedSection === "prompts"}
            onClick={() =>
              props.setSelectedSection(
                props.selectedSection === "prompts" ? null : "prompts",
              )
            }
          />
          <TopToolbarIcon
            icon={FolderIcon}
            tooltip="Context"
            isSelected={props.selectedSection === "context"}
            onClick={() =>
              props.setSelectedSection(
                props.selectedSection === "context" ? null : "context",
              )
            }
          />
          <TopToolbarIcon
            icon={WrenchScrewdriverIcon}
            tooltip="Tools"
            isSelected={props.selectedSection === "tools"}
            onClick={() =>
              props.setSelectedSection(
                props.selectedSection === "tools" ? null : "tools",
              )
            }
          />
        </div>
        <AssistantSelect />
      </div>
    </div>
  );
}
