import {
  ArrowLeftIcon,
  ArrowUpOnSquareIcon,
  BeakerIcon,
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
import { useRef } from "react";
import styled from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from "..";
import { getFontSize } from "../../util";
import FileIcon from "../FileIcon";
import { ComboBoxItem, DropdownState } from "./types";

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

function DropdownIcon(props: { provider: string; className?: string }) {
  const Icon = ICONS_FOR_DROPDOWN[props.provider];
  if (!Icon) {
    return null;
  }
  return <Icon className={props.className} height="1.2em" width="1.2em" />;
}

const mainInputFontSize = getFontSize();
const UlMaxHeight = 300;

const Ul = styled.ul<{
  hidden: boolean;
  showAbove: boolean;
  ulHeightPixels: number;
  inputBoxHeight?: string;
  fontSize?: number;
  isMainInput: boolean;
}>`
  ${(props) =>
    props.showAbove
      ? `transform: translateY(-${props.ulHeightPixels + 8}px);`
      : `transform: translateY(${
          (props.isMainInput ? 5 : 4) * (props.fontSize || mainInputFontSize) -
          (props.isMainInput ? 2 : 4) -
          6
        }px);`}
  position: absolute;
  /* background: ${vscBackground}; */
  background-color: transparent;
  backdrop-filter: blur(12px);

  color: ${vscForeground};
  max-height: ${UlMaxHeight}px;
  margin-left: 1px;
  width: calc(100% - 18px);
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 0;
  ${({ hidden }) => hidden && "display: none;"}
  border-radius: ${defaultBorderRadius};
  outline: 0.5px solid ${lightGray};
  -ms-overflow-style: none;
  font-size: ${(props) => props.fontSize || mainInputFontSize}px;

  scrollbar-width: none; /* Firefox */
  z-index: 500;

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Li = styled.li<{
  highlighted: boolean;
  isLastItem: boolean;
}>`
  background-color: ${({ highlighted }) =>
    highlighted ? buttonColor + "66" : "transparent"};
  padding: 0.35rem 0.5rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  ${({ isLastItem }) => isLastItem && "border-bottom: 1px solid gray;"}
  cursor: pointer;
  z-index: 500;
`;

interface InputDropdownProps {
  isMainInput: boolean;
  showAbove: boolean;
  items: ComboBoxItem[];
  dropdownState: DropdownState;
  highlightedIndex: number;

  subMenuTitle?: string;
  exitSubMenu?: () => void;
  selectItem?: (item: ComboBoxItem) => () => void;
}

function InputDropdown(props: InputDropdownProps) {
  const stickyDropdownHeaderDiv = useRef<HTMLDivElement>(null);

  return (
    <Ul
      isMainInput={props.isMainInput}
      showAbove={props.showAbove}
      ulHeightPixels={
        // ulRef.current?.getBoundingClientRect().height || 0
        0
      }
      fontSize={getFontSize()}
      hidden={props.dropdownState === "closed"}
    >
      {props.subMenuTitle && (
        <div
          ref={stickyDropdownHeaderDiv}
          style={{
            backgroundColor: secondaryDark,
            borderBottom: `0.5px solid ${lightGray}`,
            display: "flex",
            gap: "4px",
            position: "sticky",
            top: "0px",
          }}
          className="py-2 px-4 my-0"
        >
          <ArrowLeftIcon
            width="1.4em"
            height="1.4em"
            className="cursor-pointer"
            onClick={props.exitSubMenu}
          />
          {props.subMenuTitle}
        </div>
      )}
      <div
        style={{
          maxHeight: `${
            UlMaxHeight - (stickyDropdownHeaderDiv.current?.clientHeight || 50)
          }px`,
          overflow: "auto",
        }}
      >
        {props.dropdownState !== "closed" &&
          props.items.map((item, index) => (
            <Li
              style={{
                borderTop: index === 0 ? "none" : `0.5px solid ${lightGray}`,
              }}
              key={`${item.title}${index}`}
              highlighted={props.highlightedIndex === index}
              onClick={() => props.selectItem(item)}
              isLastItem={index === props.items.length - 1}
            >
              <span className="flex justify-between w-full items-center">
                <div className="flex items-center justify-center">
                  {props.subMenuTitle && (
                    <FileIcon
                      height="20px"
                      width="20px"
                      filename={item.title}
                    ></FileIcon>
                  )}
                  <DropdownIcon provider={item.title} className="mr-2" />
                  <DropdownIcon provider={item.id} className="mr-2" />
                  {item.title}
                  {"  "}
                </div>
                <span
                  style={{
                    color: vscForeground,
                    float: "right",
                    textAlign: "right",
                  }}
                  hidden={props.highlightedIndex !== index}
                  className="whitespace-nowrap overflow-hidden overflow-ellipsis ml-2"
                >
                  {item.description}
                </span>
              </span>
              {/* {contextProviders
                ?.filter(
                  (provider) =>
                    !provider.description.dynamic ||
                    provider.description.requiresQuery
                )
                .find((provider) => provider.description.title === item.id) && (
                <ArrowRightIcon
                  width="1.2em"
                  height="1.2em"
                  color={vscForeground}
                  className="ml-2 flex-shrink-0"
                />
              )} */}
            </Li>
          ))}
        {props.dropdownState !== "closed" && props.items.length === 0 && (
          <Li key="empty-items-li" highlighted={false} isLastItem={false}>
            <span
              style={{
                color: lightGray,
                float: "right",
                textAlign: "right",
                display: "flex",
                width: "100%",
                cursor: "default",
              }}
            >
              No items found
            </span>
          </Li>
        )}
      </div>
    </Ul>
  );
}

export default InputDropdown;
