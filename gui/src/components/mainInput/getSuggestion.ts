import { Editor, ReactRenderer } from "@tiptap/react";
import { IContextProvider } from "core";
import { ExtensionIde } from "core/ide";
import { getBasename } from "core/util";
import MiniSearch from "minisearch";
import { MutableRefObject } from "react";
import tippy from "tippy.js";
import MentionList from "./MentionList";
import { ComboBoxItem, ComboBoxItemType } from "./types";

function getSuggestion(
  items: (props: { query: string }) => ComboBoxItem[],
  enterSubmenu: (editor: Editor, providerId: string) => void = (editor) => {},
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
          popup?.[0]?.destroy();
          component.destroy();
          onClose();
        },
      };
    },
  };
}

let openFiles: ComboBoxItem[] = [];

function refreshOpenFiles() {
  new ExtensionIde().getOpenFiles().then(
    (files) =>
      (openFiles = files.map((file) => {
        const baseName = getBasename(file);
        const lastTwoParts = file.split(/[\\/]/).slice(-2).join("/");
        return {
          title: baseName,
          description: lastTwoParts,
          id: file,
          content: file,
          label: baseName,
          type: "file" as ComboBoxItemType,
        };
      }))
  );
}
refreshOpenFiles();

let folders: ComboBoxItem[] = [];
function refreshFolders() {
  new ExtensionIde().listFolders().then((f) => {
    folders = f.map((folder) => {
      const baseName = getBasename(folder);
      const lastTwoParts = folder.split(/[\\/]/).slice(-2).join("/");
      return {
        title: baseName,
        description: lastTwoParts,
        id: "folder",
        content: folder,
        label: baseName,
        type: "folder" as ComboBoxItemType,
        query: folder,
      };
    });
  });
}
refreshFolders();

function getFileItems(
  query: string,
  miniSearch: MiniSearch,
  firstResults: any[]
): ComboBoxItem[] {
  let res: any[] = miniSearch.search(query.trim() === "" ? "/" : query, {
    prefix: true,
    fuzzy: 4,
  });
  if (res.length === 0) {
    return openFiles.length > 0 ? openFiles : firstResults;
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

function getFolderItems(
  query: string,
  miniSearch: MiniSearch,
  firstResults: any[]
): ComboBoxItem[] {
  let res: any[] = miniSearch.search(query.trim() === "" ? "/" : query, {
    prefix: true,
    fuzzy: 5,
  });

  if (res.length === 0) {
    return folders.slice(0, 10);
  }
  return (
    res?.slice(0, 10).map((hit) => {
      const lastTwoParts = hit.id.split(/[\\/]/).slice(-2).join("/");
      const item = {
        title: hit.basename,
        description: lastTwoParts,
        id: "folder",
        content: hit.id,
        label: hit.basename,
        query: hit.id,
        type: "folder" as ComboBoxItemType,
      };
      return item;
    }) || []
  );
}

export function getMentionSuggestion(
  availableContextProvidersRef: MutableRefObject<IContextProvider[]>,
  filesMiniSearchRef: MutableRefObject<MiniSearch>,
  filesFirstResultsRef: MutableRefObject<any[]>,
  foldersMiniSearchRef: MutableRefObject<MiniSearch>,
  foldersFirstResultsRef: MutableRefObject<any[]>,
  enterSubmenu: (editor: Editor, providerId: string) => void,
  onClose: () => void,
  onOpen: () => void,
  inSubmenu: MutableRefObject<string>
) {
  const items = ({ query }) => {
    if (inSubmenu.current === "file") {
      return getFileItems(
        query,
        filesMiniSearchRef.current,
        filesFirstResultsRef.current
      );
    } else if (inSubmenu.current === "folder") {
      return getFolderItems(
        query,
        foldersMiniSearchRef.current,
        filesFirstResultsRef.current
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
        filesMiniSearchRef.current,
        filesFirstResultsRef.current
      );
    }
    return mainResults;
  };

  refreshOpenFiles();
  return getSuggestion(items, enterSubmenu, onClose, onOpen);
}

export function getCommandSuggestion(
  availableSlashCommandsRef: MutableRefObject<ComboBoxItem[]>,
  onClose: () => void,
  onOpen: () => void
) {
  const items = ({ query }) => {
    return (
      availableSlashCommandsRef.current?.filter((slashCommand) => {
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
