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

const ContextItemDiv = styled.div`
  cursor: pointer;
  padding: 6px 10px 6px 6px;
  margin-left: 4px;
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

interface ContextItemsPeekProps {
  contextItems?: ContextItemWithId[];
}

const ContextItemsPeek = (props: ContextItemsPeekProps) => {
  const ideMessenger = useContext(IdeMessengerContext);

  const [open, setOpen] = React.useState(false);

  if (!props.contextItems || props.contextItems.length === 0) {
    return null;
  }

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
        <span className="ms-1">Context Used</span>
      </div>
      {open && (
        <div
          style={{
            paddingTop: "2px",
          }}
        >
          {props.contextItems?.map((contextItem, idx) => {
            if (contextItem.description.startsWith("http")) {
              return (
                <a
                  key={idx}
                  href={contextItem.description}
                  target="_blank"
                  style={{ color: vscForeground, textDecoration: "none" }}
                >
                  <ContextItemDiv
                    onClick={() => {
                      openContextItem(contextItem);
                    }}
                  >
                    {!!contextItem.icon ? (
                      <SafeImg
                        className="flex-shrink-0 pr-2"
                        src={contextItem.icon}
                        height="18em"
                        width="18em"
                        fallback={null}
                      />
                    ) : (
                      <FileIcon
                        filename={
                          contextItem.description
                            .split(" ")
                            .shift()
                            .split("#")
                            .shift() || ""
                        }
                        height="1.6em"
                        width="1.6em"
                      ></FileIcon>
                    )}
                    {contextItem.name}
                  </ContextItemDiv>
                </a>
              );
            }

            return (
              <ContextItemDiv
                key={idx}
                onClick={() => {
                  openContextItem(contextItem);
                }}
              >
                {!!contextItem.icon ? (
                  <SafeImg
                    className="flex-shrink-0 pr-2"
                    src={contextItem.icon}
                    height="18em"
                    width="18em"
                    fallback={null}
                  />
                ) : (
                  <FileIcon
                    filename={contextItem.description.split(" ").shift()}
                    height="1.6em"
                    width="1.6em"
                  ></FileIcon>
                )}
                {contextItem.name}
              </ContextItemDiv>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContextItemsPeek;
