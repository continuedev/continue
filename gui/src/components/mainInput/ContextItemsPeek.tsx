import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { contextItemToRangeInFileWithContents } from "core/commands/util";
import React, { useContext } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscForeground,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getFontSize } from "../../util";
import FileIcon from "../FileIcon";
import SafeImg from "../SafeImg";
import { INSTRUCTIONS_BASE_ITEM } from "core/context/providers/utils";
import { getIconFromDropdownItem } from "./MentionList";

const ContextItemDiv = styled.div`
  cursor: pointer;
  padding: 6px 10px 6px 6px;
  margin-left: 4px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  border-radius: ${defaultBorderRadius};
  font-size: ${getFontSize()};
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &:hover {
    background-color: #fff1;
  }
`;

export const ContextItems = styled.span`
  margin-left: 5px;
  font-size: ${getFontSize() - 1}px;
  color: ${lightGray};

  &:hover {
    text-decoration: underline;
  }
`;

interface ContextItemsPeekProps {
  contextItems?: ContextItemWithId[];
}

function filterInstructionContextItem(
  contextItems: ContextItemsPeekProps["contextItems"],
) {
  return contextItems?.filter(
    (ctxItem) => !ctxItem.name.includes(INSTRUCTIONS_BASE_ITEM.name),
  );
}

const ContextItemsPeek = (props: ContextItemsPeekProps) => {
  const ideMessenger = useContext(IdeMessengerContext);

  const [open, setOpen] = React.useState(false);

  const ctxItems = filterInstructionContextItem(props.contextItems);

  if (!ctxItems || ctxItems.length === 0) {
    return null;
  }

  const contextItemsText = `${ctxItems.length} context ${
    ctxItems.length > 1 ? "items" : "item"
  }`;

  function openContextItem(contextItem: ContextItemWithId) {
    if (contextItem.description.startsWith("http")) {
      window.open(contextItem.description, "_blank");
    } else if (
      contextItem.description.startsWith("/") ||
      contextItem.description.startsWith("\\")
    ) {
      if (contextItem.name.includes(" (") && contextItem.name.endsWith(")")) {
        const rif = contextItemToRangeInFileWithContents(contextItem);
        ideMessenger.ide.showLines(
          rif.filepath,
          rif.range.start.line,
          rif.range.end.line,
        );
      } else {
        ideMessenger.ide.openFile(contextItem.description);
      }
    } else {
      ideMessenger.ide.showVirtualFile(contextItem.name, contextItem.content);
    }
  }

  const getContextItemIcon = (contextItem: ContextItemWithId) => {
    const dimmensions = "1.4em";

    if (contextItem.icon) {
      return (
        <SafeImg
          className="flex-shrink-0 pr-2"
          src={contextItem.icon}
          height={dimmensions}
          width={dimmensions}
          fallback={null}
        />
      );
    }

    // Heuristic to check if it's a file
    const shouldShowFileIcon = contextItem.content.includes("```");

    if (shouldShowFileIcon) {
      return (
        <FileIcon
          filename={
            contextItem.description.split(" ").shift()?.split("#").shift() || ""
          }
          height={dimmensions}
          width={dimmensions}
        />
      );
    }

    const ProviderIcon = getIconFromDropdownItem(
      contextItem.id.providerTitle,
      "contextProvider",
    );

    return (
      <ProviderIcon
        className="flex-shrink-0 pr-2"
        height={dimmensions}
        width={dimmensions}
      />
    );
  };

  return (
    <div
      style={{
        paddingLeft: "8px",
        paddingTop: "8px",
        backgroundColor: vscBackground,
      }}
    >
      <div
        style={{
          color: lightGray,
          cursor: "pointer",
          display: "flex",
          justifyContent: "left",
          alignItems: "center",
          fontSize: `${getFontSize() - 3}px`,
        }}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? (
          <ChevronUpIcon
            width="1.0em"
            height="1.0em"
            style={{ color: lightGray }}
          ></ChevronUpIcon>
        ) : (
          <ChevronDownIcon
            width="1.0em"
            height="1.0em"
            style={{ color: lightGray }}
          ></ChevronDownIcon>
        )}
        <ContextItems>{contextItemsText}</ContextItems>
      </div>

      {open && (
        <div
          style={{
            paddingTop: "2px",
          }}
        >
          {ctxItems?.map((contextItem, idx) => {
            const contextItemContent = (
              <ContextItemDiv onClick={() => openContextItem(contextItem)}>
                {getContextItemIcon(contextItem)}
                {contextItem.name}
              </ContextItemDiv>
            );

            return contextItem.description.startsWith("http") ? (
              <a
                key={idx}
                href={contextItem.description}
                target="_blank"
                style={{ color: vscForeground, textDecoration: "none" }}
              >
                {contextItemContent}
              </a>
            ) : (
              <React.Fragment key={idx}>{contextItemContent}</React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContextItemsPeek;
