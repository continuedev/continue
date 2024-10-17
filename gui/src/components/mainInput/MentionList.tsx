import {
  ArrowRightIcon,
  ArrowUpOnSquareIcon,
  AtSymbolIcon,
  BoltIcon,
  BookOpenIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeAltIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Editor } from "@tiptap/react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscForeground,
  vscListActiveBackground,
  vscListActiveForeground,
  vscQuickInputBackground,
} from "..";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import ButtonWithTooltip from "../ButtonWithTooltip";
import FileIcon from "../FileIcon";
import SafeImg from "../SafeImg";
import AddDocsDialog from "../dialogs/AddDocsDialog";
import { ComboBoxItem, ComboBoxItemType } from "./types";

const ICONS_FOR_DROPDOWN: { [key: string]: any } = {
  file: FolderIcon,
  code: CodeBracketIcon,
  terminal: CommandLineIcon,
  diff: PlusIcon,
  search: MagnifyingGlassIcon,
  url: GlobeAltIcon,
  open: FolderOpenIcon,
  codebase: SparklesIcon,
  problems: ExclamationTriangleIcon,
  folder: FolderIcon,
  docs: BookOpenIcon,
  issue: ExclamationCircleIcon,
  trash: TrashIcon,
  web: GlobeAltIcon,
  "repo-map": FolderIcon,
  "/edit": PencilIcon,
  "/clear": TrashIcon,
  "/comment": HashtagIcon,
  "/share": ArrowUpOnSquareIcon,
  "/cmd": CommandLineIcon,
};

export function getIconFromDropdownItem(id: string, type: ComboBoxItemType) {
  return (
    ICONS_FOR_DROPDOWN[id] ??
    (type === "contextProvider" ? AtSymbolIcon : BoltIcon)
  );
}

function DropdownIcon(props: { className?: string; item: ComboBoxItem }) {
  if (props.item.type === "action") {
    return (
      <PlusIcon className={props.className} height="1.2em" width="1.2em" />
    );
  }

  const provider =
    props.item.type === "contextProvider" || props.item.type === "slashCommand"
      ? props.item.id
      : props.item.type;

  const IconComponent = getIconFromDropdownItem(provider, props.item.type);

  const fallbackIcon = (
    <IconComponent
      className={`${props.className} flex-shrink-0`}
      height="1.2em"
      width="1.2em"
    />
  );

  if (!props.item.icon) {
    return fallbackIcon;
  }

  return (
    <SafeImg
      className="flex-shrink-0 pr-2"
      src={props.item.icon}
      height="18em"
      width="18em"
      fallback={fallbackIcon}
    />
  );
}

const ItemsDiv = styled.div`
  border-radius: ${defaultBorderRadius};
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0px 10px 20px rgba(0, 0, 0, 0.1);
  font-size: 0.9rem;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 330px;
  padding: 0.2rem;
  position: relative;

  background-color: ${vscQuickInputBackground};
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
    background-color: ${vscListActiveBackground};
    color: ${vscListActiveForeground};
  }
`;

const QueryInput = styled.textarea`
  background-color: #fff1;
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};

  padding: 0.2rem 0.4rem;
  width: 240px;

  color: ${vscForeground};

  &:focus {
    outline: none;
  }

  font-family: inherit;
  resize: none;
`;

interface MentionListProps {
  items: ComboBoxItem[];
  command: (item: any) => void;

  editor: Editor;
  enterSubmenu?: (editor: Editor, providerId: string) => void;
  onClose: () => void;
}

const MentionList = forwardRef((props: MentionListProps, ref) => {
  const dispatch = useDispatch();

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [subMenuTitle, setSubMenuTitle] = useState<string | undefined>(
    undefined,
  );
  const [querySubmenuItem, setQuerySubmenuItem] = useState<
    ComboBoxItem | undefined
  >(undefined);

  const [allItems, setAllItems] = useState<ComboBoxItem[]>([]);

  useEffect(() => {
    const items = [...props.items];
    if (subMenuTitle === "Type to search docs") {
      items.push({
        title: "Add Docs",
        type: "action",
        action: () => {
          dispatch(setShowDialog(true));
          dispatch(setDialogMessage(<AddDocsDialog />));

          // Delete back to last '@'
          const { tr } = props.editor.view.state;
          const text = tr.doc.textBetween(0, tr.selection.from);
          const start = text.lastIndexOf("@");
          props.editor.view.dispatch(
            tr.delete(start, tr.selection.from).scrollIntoView(),
          );
        },
        description: "Add a new documentation source",
      });
    }

    setAllItems(items);
  }, [subMenuTitle, props.items, props.editor]);

  const queryInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (queryInputRef.current) {
      queryInputRef.current.focus();
    }
  }, [querySubmenuItem]);

  const selectItem = (index) => {
    const item = allItems[index];

    if (item.type === "action" && item.action) {
      item.action();
      return;
    }

    if (
      item.type === "contextProvider" &&
      item.contextProvider?.type === "submenu"
    ) {
      setSubMenuTitle(item.description);
      props.enterSubmenu(props.editor, item.id);
      return;
    }

    if (item.contextProvider?.type === "query") {
      // update editor to complete context provider title
      const { tr } = props.editor.view.state;
      const text = tr.doc.textBetween(0, tr.selection.from);
      const partialText = text.slice(text.lastIndexOf("@") + 1);
      const remainingText = item.title.slice(partialText.length);
      props.editor.view.dispatch(
        tr.insertText(remainingText, tr.selection.from),
      );

      setSubMenuTitle(item.description);
      setQuerySubmenuItem(item);
      return;
    }

    if (item) {
      props.command({ ...item, itemType: item.type });
    }
  };

  const totalItems = allItems.length;

  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const upHandler = () => {
    setSelectedIndex((prevIndex) => {
      const newIndex = prevIndex - 1 >= 0 ? prevIndex - 1 : 0;
      itemRefs.current[newIndex]?.scrollIntoView({
        behavior: "instant" as ScrollBehavior,
        block: "nearest",
      });
      return newIndex;
    });
  };

  const downHandler = () => {
    setSelectedIndex((prevIndex) => {
      const newIndex = prevIndex + 1 < totalItems ? prevIndex + 1 : prevIndex;
      itemRefs.current[newIndex]?.scrollIntoView({
        behavior: "instant" as ScrollBehavior,
        block: "nearest",
      });
      return newIndex;
    });
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [allItems]);

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

      if (event.key === "Enter" || event.key === "Tab") {
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
        if (allItems.length === 1) {
          enterHandler();
          return true;
        }
      }

      return false;
    },
  }));

  const showFileIconForItem = (item: ComboBoxItem) => {
    return ["file", "code"].includes(item.type);
  };

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, allItems.length);
  }, [allItems]);

  return (
    <ItemsDiv className="items-container">
      {querySubmenuItem ? (
        <QueryInput
          rows={1}
          ref={queryInputRef}
          placeholder={querySubmenuItem.description}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (e.shiftKey) {
                queryInputRef.current.innerText += "\n";
              } else {
                props.command({
                  ...querySubmenuItem,
                  itemType: querySubmenuItem.type,
                  query: queryInputRef.current.value,
                  label: `${querySubmenuItem.label}: ${queryInputRef.current.value}`,
                });
              }
            } else if (e.key === "Escape") {
              setQuerySubmenuItem(undefined);
              setSubMenuTitle(undefined);
            }
          }}
        />
      ) : (
        <>
          {subMenuTitle && <ItemDiv className="mb-2">{subMenuTitle}</ItemDiv>}
          {/* <CustomScrollbarDiv className="overflow-y-scroll max-h-96"> */}
          {allItems.length ? (
            allItems.map((item, index) => (
              <ItemDiv
                as="button"
                ref={(el) => (itemRefs.current[index] = el)}
                className={`item ${
                  index === selectedIndex ? "is-selected" : ""
                }`}
                key={index}
                onClick={() => selectItem(index)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="flex justify-between w-full items-center">
                  <div className="flex items-center justify-center">
                    {showFileIconForItem(item) && (
                      <FileIcon
                        height="20px"
                        width="20px"
                        filename={item.description}
                      ></FileIcon>
                    )}
                    {!showFileIconForItem(item) && (
                      <>
                        <DropdownIcon item={item} className="mr-2" />
                      </>
                    )}
                    <span title={item.id}>{item.title}</span>
                    {"  "}
                  </div>
                  <span
                    style={{
                      color: vscListActiveForeground,
                      float: "right",
                      textAlign: "right",
                      opacity: index !== selectedIndex ? 0 : 1,
                      minWidth: "30px",
                    }}
                    className="whitespace-nowrap overflow-hidden overflow-ellipsis ml-2 flex items-center"
                  >
                    {item.description}
                    {item.type === "contextProvider" &&
                      item.contextProvider?.type === "submenu" && (
                        <ArrowRightIcon
                          className="ml-2 flex-shrink-0"
                          width="1.2em"
                          height="1.2em"
                        />
                      )}
                    {item.subActions?.map((subAction) => {
                      const Icon = ICONS_FOR_DROPDOWN[subAction.icon];
                      return (
                        <ButtonWithTooltip
                          onClick={(e) => {
                            subAction.action(item);
                            e.stopPropagation();
                            e.preventDefault();
                            props.onClose();
                          }}
                          text={undefined}
                        >
                          <Icon width="1.2em" height="1.2em" />
                        </ButtonWithTooltip>
                      );
                    })}
                  </span>
                </span>
              </ItemDiv>
            ))
          ) : (
            <ItemDiv className="item">No results</ItemDiv>
          )}
          {/* </CustomScrollbarDiv> */}
        </>
      )}
    </ItemsDiv>
  );
});
export default MentionList;
