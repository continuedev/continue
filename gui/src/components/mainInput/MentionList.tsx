import {
  ArrowRightIcon,
  ArrowUpOnSquareIcon,
  AtSymbolIcon,
  BeakerIcon,
  BookOpenIcon,
  ChevronDoubleRightIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
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
import FileIcon from "../FileIcon";
import AddDocsDialog from "../dialogs/AddDocsDialog";
import { ComboBoxItem } from "./types";

const ICONS_FOR_DROPDOWN: { [key: string]: any } = {
  file: FolderIcon,
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

function DropdownIcon(props: { className?: string; item: ComboBoxItem }) {
  if (props.item.type === "action") {
    return (
      <PlusIcon className={props.className} height="1.2em" width="1.2em" />
    );
  }

  const provider =
    props.item.type === "contextProvider"
      ? props.item.id
      : props.item.type === "slashCommand"
      ? props.item.id
      : props.item.type;

  const Icon = ICONS_FOR_DROPDOWN[provider];
  const iconClass = `${props.className} flex-shrink-0`;
  if (!Icon) {
    return props.item.type === "contextProvider" ? (
      <AtSymbolIcon className={iconClass} height="1.2em" width="1.2em" />
    ) : (
      <ChevronDoubleRightIcon
        className={iconClass}
        height="1.2em"
        width="1.2em"
      />
    );
  }
  return <Icon className={iconClass} height="1.2em" width="1.2em" />;
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
}

const MentionList = forwardRef((props: MentionListProps, ref) => {
  const dispatch = useDispatch();

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [subMenuTitle, setSubMenuTitle] = useState<string | undefined>(
    undefined
  );
  const [querySubmenuItem, setQuerySubmenuItem] = useState<
    ComboBoxItem | undefined
  >(undefined);

  const [allItems, setAllItems] = useState<ComboBoxItem[]>([]);

  useEffect(() => {
    const items = [...props.items];
    if (subMenuTitle === "Search documentation") {
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
            tr.delete(start, tr.selection.from).scrollIntoView()
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
      setSubMenuTitle(item.description);
      setQuerySubmenuItem(item);
      return;
    }

    if (item) {
      props.command({ ...item, itemType: item.type });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + allItems.length - 1) % allItems.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % allItems.length);
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

  return (
    <ItemsDiv>
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
                  query: queryInputRef.current.value,
                  label: `${querySubmenuItem.label}: ${queryInputRef.current.value}`,
                  itemType: querySubmenuItem.type,
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
          {allItems.length ? (
            allItems.map((item, index) => (
              <ItemDiv
                as="button"
                className={`item ${
                  index === selectedIndex ? "is-selected" : ""
                }`}
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
                      <>
                        <DropdownIcon item={item} className="mr-2" />
                      </>
                    )}
                    {item.title}
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
                  </span>
                </span>
              </ItemDiv>
            ))
          ) : (
            <ItemDiv className="item">No results</ItemDiv>
          )}
        </>
      )}
    </ItemsDiv>
  );
});
export default MentionList;
