import { Editor, ReactRenderer } from "@tiptap/react";
import { IContextProvider } from "core";
import MiniSearch from "minisearch";
import { MutableRefObject } from "react";
import tippy from "tippy.js";
import MentionList from "./MentionList";
import { ComboBoxItem, ComboBoxItemType } from "./types";

function getSuggestion(
  items: (props: { query: string }) => ComboBoxItem[],
  enterSubmenu: (editor: Editor) => void = (editor) => {},
  onClose: () => void = () => {},
  onOpen: () => void = () => {}
) {
  return {
    items,
    allowSpaces: true,
    render: () => {
      let component;
      let popup;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props: { ...props, enterSubmenu },
            editor: props.editor,
          });

          if (!props.clientRect) {
            console.log("no client rect");
            return;
          }

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });

          onOpen();
        },

        onUpdate(props) {
          component.updateProps({ ...props, enterSubmenu });

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup[0].hide();

            return true;
          }

          return component.ref?.onKeyDown(props);
        },

        onExit() {
          popup[0]?.destroy();
          component.destroy();
          onClose();
        },
      };
    },
  };
}

function getFileItems(
  query: string,
  miniSearch: MiniSearch,
  firstResults: any[]
): ComboBoxItem[] {
  let res: any[] = miniSearch.search(query.trim() === "" ? "/" : query, {
    prefix: true,
    fuzzy: 1,
  });
  if (res.length === 0) {
    res = firstResults;
  }
  return (
    res?.slice(0, 10).map((hit) => {
      const lastTwoParts = hit.id.split(/[\\/]/).slice(-2).join("/");
      const item = {
        title: hit.basename,
        description: lastTwoParts,
        id: hit.id,
        content: hit.id,
        label: hit.basename,
        type: "file" as ComboBoxItemType,
      };
      return item;
    }) || []
  );
}

export function getMentionSuggestion(
  availableContextProvidersRef: MutableRefObject<IContextProvider[]>,
  miniSearchRef: MutableRefObject<MiniSearch>,
  firstResultsRef: MutableRefObject<any[]>,
  enterSubmenu: (editor: Editor) => void,
  onClose: () => void,
  onOpen: () => void,
  inSubmenu: MutableRefObject<boolean>
) {
  const items = ({ query }) => {
    if (inSubmenu.current) {
      return getFileItems(
        query,
        miniSearchRef.current,
        firstResultsRef.current
      );
    }

    const mainResults =
      availableContextProvidersRef.current
        ?.filter(
          (provider) =>
            provider.description.title
              .toLowerCase()
              .startsWith(query.toLowerCase()) ||
            provider.description.displayTitle
              .toLowerCase()
              .startsWith(query.toLowerCase())
        )
        .map((provider) => ({
          name: provider.description.displayTitle,
          description: provider.description.description,
          id: provider.description.title,
          title: provider.description.displayTitle,
          label: provider.description.displayTitle,
          type: "contextProvider" as ComboBoxItemType,
          contextProvider: provider.description,
        }))
        .sort((c, _) => (c.id === "file" ? -1 : 1)) || [];

    if (mainResults.length === 0) {
      return getFileItems(
        query,
        miniSearchRef.current,
        firstResultsRef.current
      );
    }
    return mainResults;
  };
  return getSuggestion(items, enterSubmenu, onClose, onOpen);
}

export function getCommandSuggestion(
  availableSlashCommands: ComboBoxItem[],
  onClose: () => void,
  onOpen: () => void
) {
  const items = ({ query }) => {
    return (
      availableSlashCommands?.filter((slashCommand) => {
        const sc = slashCommand.title.substring(1).toLowerCase();
        const iv = query.toLowerCase();
        return sc.startsWith(iv);
      }) || []
    ).map((provider) => ({
      name: provider.title,
      description: provider.description,
      id: provider.title,
      title: provider.title,
      label: provider.title,
      type: "slashCommand" as ComboBoxItemType,
    }));
  };
  return getSuggestion(items, undefined, onClose, onOpen);
}
