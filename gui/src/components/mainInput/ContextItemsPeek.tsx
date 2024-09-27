import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { ctxItemToRifWithContents } from "core/commands/util";
import { useContext, useState } from "react";
import { lightGray, vscBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getFontSize } from "../../util";
import FileIcon from "../FileIcon";
import SafeImg from "../SafeImg";
import { INSTRUCTIONS_BASE_ITEM } from "core/context/providers/utils";
import { getIconFromDropdownItem } from "./MentionList";
import styled from "styled-components";
import { getBasename } from "core/util";

interface ContextItemsPeekProps {
  contextItems?: ContextItemWithId[];
  isGatheringContext: boolean;
}

interface ContextItemsPeekItemProps {
  contextItem: ContextItemWithId;
}

const AnimatedEllipsis = styled.span`
  &::after {
    content: ".";
    animation: ellipsis 2.5s infinite;
    display: inline-block;
    width: 12px;
    text-align: left;
  }

  @keyframes ellipsis {
    0% {
      content: ".";
    }
    33% {
      content: "..";
    }
    66% {
      content: "...";
    }
  }
`;

function ContextItemsPeekItem({ contextItem }: ContextItemsPeekItemProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function openContextItem() {
    const { uri, name, description, content } = contextItem;

    if (uri?.type === "url") {
      ideMessenger.post("openUrl", uri.value);
    } else if (uri) {
      const isRangeInFile = name.includes(" (") && name.endsWith(")");

      if (isRangeInFile) {
        const rif = ctxItemToRifWithContents(contextItem);
        ideMessenger.ide.showLines(
          rif.filepath,
          rif.range.start.line,
          rif.range.end.line,
        );
      } else {
        ideMessenger.ide.openFile(description);
      }
    } else {
      ideMessenger.ide.showVirtualFile(name, content);
    }
  }

  function getContextItemIcon() {
    const dimensions = "18px";

    if (contextItem.icon) {
      return (
        <SafeImg
          className="flex-shrink-0 mr-2 rounded-md p-1"
          src={contextItem.icon}
          height={dimensions}
          width={dimensions}
          fallback={null}
        />
      );
    }

    // Heuristic to check if it's a file
    const shouldShowFileIcon = contextItem.content.includes("```");

    if (shouldShowFileIcon) {
      return (
        <div className="flex-shrink-0 mr-2">
          <FileIcon
            filename={
              contextItem.description.split(" ").shift()?.split("#").shift() ||
              ""
            }
            height={dimensions}
            width={dimensions}
          />
        </div>
      );
    }

    const ProviderIcon = getIconFromDropdownItem(
      contextItem.id.providerTitle,
      "contextProvider",
    );

    return (
      <ProviderIcon
        className="flex-shrink-0 mr-2"
        height={dimensions}
        width={dimensions}
      />
    );
  }

  return (
    <div
      onClick={openContextItem}
      className="text-xs cursor-pointer px-1.5 py-1 flex items-center rounded hover:bg-white/10 overflow-hidden whitespace-nowrap text-ellipsis mr-2"
    >
      <div className="flex items-center w-full">
        {getContextItemIcon()}
        <div className="flex min-w-0 flex-1 gap-2 text-xs">
          <div className="truncate max-w-[50%] flex-shrink-0">
            {contextItem.name}
          </div>
          <div
            className={`text-xs text-gray-400 overflow-hidden truncate whitespace-nowrap text-xs flex-1 min-w-0`}
          >
            {contextItem.uri?.type === "file"
              ? getBasename(contextItem.description)
              : contextItem.description}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextItemsPeek({
  contextItems,
  isGatheringContext,
}: ContextItemsPeekProps) {
  const [open, setOpen] = useState(false);

  const ctxItems = contextItems?.filter(
    (ctxItem) => !ctxItem.name.includes(INSTRUCTIONS_BASE_ITEM.name),
  );

  if ((!ctxItems || ctxItems.length === 0) && !isGatheringContext) {
    return null;
  }

  return (
    <div className={`pl-2 pt-2 bg-[${vscBackground}]`}>
      <div
        className="text-gray-300 cursor-pointer flex justify-start items-center text-xs"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="relative w-4 h-4 mr-1">
          <ChevronRightIcon
            className={`absolute h-4 w-4 transition-all duration-200 ease-in-out text-[${lightGray}] ${
              open ? "opacity-0 rotate-90" : "opacity-100 rotate-0"
            }`}
          />
          <ChevronDownIcon
            className={`absolute h-4 w-4 transition-all duration-200 ease-in-out text-[${lightGray}] ${
              open ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"
            }`}
          />
        </div>
        <span className="ml-1 text-xs text-gray-400 transition-colors duration-200">
          {isGatheringContext ? (
            <>
              Gathering context
              <AnimatedEllipsis />
            </>
          ) : (
            `${ctxItems.length} context ${
              ctxItems.length > 1 ? "items" : "item"
            }`
          )}
        </span>
      </div>

      <div
        className={`mt-2 overflow-y-auto transition-all duration-300 ease-in-out ${
          open ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {ctxItems &&
          ctxItems.map((contextItem, idx) => (
            <ContextItemsPeekItem key={idx} contextItem={contextItem} />
          ))}
      </div>
    </div>
  );
}

export default ContextItemsPeek;
