import {
  ArrowUpOnSquareIcon,
  AtSymbolIcon,
  BeakerIcon,
  ChevronDoubleRightIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeAltIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  PaintBrushIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Editor } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import styled from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  secondaryDark,
  vscForeground,
} from "..";
import FileIcon from "../FileIcon";
import { ComboBoxItem, ComboBoxItemType } from "./types";

const ICONS_FOR_DROPDOWN: { [key: string]: any } = {
  file: FolderIcon,
  terminal: CommandLineIcon,
  diff: PlusIcon,
  search: MagnifyingGlassIcon,
  url: GlobeAltIcon,
  open: FolderOpenIcon,
  "/edit": PaintBrushIcon,
  "/clear": TrashIcon,
  "/test": BeakerIcon,
  "/config": Cog6ToothIcon,
  "/comment": HashtagIcon,
  "/share": ArrowUpOnSquareIcon,
  "/cmd": CommandLineIcon,
  "/codebase": SparklesIcon,
  "/so": GlobeAltIcon,
  "/issue": ExclamationCircleIcon,
};

function DropdownIcon(props: {
  provider: string;
  className?: string;
  type: ComboBoxItemType;
}) {
  const Icon = ICONS_FOR_DROPDOWN[props.provider];
  if (!Icon) {
    return props.type === "contextProvider" ? (
      <AtSymbolIcon className={props.className} height="1.2em" width="1.2em" />
    ) : (
      <ChevronDoubleRightIcon
        className={props.className}
        height="1.2em"
        width="1.2em"
      />
    );
  }
  return <Icon className={props.className} height="1.2em" width="1.2em" />;
}

const ItemsDiv = styled.div`
  border-radius: ${defaultBorderRadius};
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0px 10px 20px rgba(0, 0, 0, 0.1);
  font-size: 0.9rem;
  overflow: hidden;
  padding: 0.2rem;
  position: relative;

  background-color: ${secondaryDark};
  /* backdrop-filter: blur(12px); */
`;

const ItemDiv = styled.div`
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.4rem;
  display: block;
  margin: 0;
  padding: 0.2rem 0.4rem;
  text-align: left;
  width: 100%;
  color: ${vscForeground};
  cursor: pointer;

  &.is-selected {
    background-color: ${buttonColor}33;
  }
`;

interface MentionListProps {
  items: ComboBoxItem[];
  command: (item: ComboBoxItem) => void;

  editor: Editor;
  enterSubmenu?: (editor: Editor) => void;
}

const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [subMenuTitle, setSubMenuTitle] = useState<string | undefined>(
    undefined
  );

  const selectItem = (index) => {
    const item = props.items[index];

    if (item.id === "file") {
      setSubMenuTitle("Files - Type to search");
      props.enterSubmenu(props.editor);
      return;
    }

    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        event.stopPropagation();
        event.preventDefault();
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      if (event.key === " ") {
        if (props.items.length === 1) {
          enterHandler();
          return true;
        }
      }

      return false;
    },
  }));

  return (
    <ItemsDiv>
      {subMenuTitle && <ItemDiv className="mb-2">{subMenuTitle}</ItemDiv>}
      {props.items.length ? (
        props.items.map((item, index) => (
          <ItemDiv
            as="button"
            className={`item ${index === selectedIndex ? "is-selected" : ""}`}
            key={index}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="flex justify-between w-full items-center">
              <div className="flex items-center justify-center">
                {item.type === "file" && (
                  <FileIcon
                    height="20px"
                    width="20px"
                    filename={item.title}
                  ></FileIcon>
                )}
                {item.type !== "file" && (
                  <DropdownIcon
                    provider={item.id}
                    type={item.type}
                    className="mr-2"
                  />
                )}
                {item.title}
                {"  "}
              </div>
              <span
                style={{
                  color: vscForeground,
                  float: "right",
                  textAlign: "right",
                  opacity: index !== selectedIndex ? 0 : 1,
                }}
                className="whitespace-nowrap overflow-hidden overflow-ellipsis ml-2"
              >
                {item.description}
              </span>
            </span>
          </ItemDiv>
        ))
      ) : (
        <ItemDiv className="item">No result</ItemDiv>
      )}
    </ItemsDiv>
  );
});
export default MentionList;
