import { Editor, ReactRenderer } from "@tiptap/react";
import { ContextProviderDescription, ContextSubmenuItem } from "core";
import { MutableRefObject } from "react";
import tippy from "tippy.js";
import { IIdeMessenger } from "../../context/IdeMessenger";
import MentionList from "./MentionList";
import { ComboBoxItem, ComboBoxItemType } from "./types";

function getSuggestion(
  items: (props: { query: string }) => Promise<ComboBoxItem[]>,
  enterSubmenu: (editor: Editor, providerId: string) => void = (editor) => {},
  onClose: () => void = () => {},
  onOpen: () => void = () => {},
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
            maxWidth: `${window.innerWidth - 24}px`,
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
          component?.destroy();
          onClose();
        },
      };
    },
  };
}

export function getMentionSuggestion(
  availableContextProvidersRef: MutableRefObject<ContextProviderDescription[]>,
  getSubmenuContextItemsRef: MutableRefObject<
    (
      providerTitle: string | undefined,
      query: string,
    ) => (ContextSubmenuItem & { providerTitle: string })[]
  >,
  enterSubmenu: (editor: Editor, providerId: string) => void,
  onClose: () => void,
  onOpen: () => void,
  inSubmenu: MutableRefObject<string | undefined>,
  ideMessenger: IIdeMessenger,
) {
  const items = async ({ query }) => {
    if (inSubmenu.current) {
      const results = getSubmenuContextItemsRef.current(
        inSubmenu.current,
        query,
      );
      return results.map((result) => {
        return {
          ...result,
          label: result.title,
          type: inSubmenu.current as ComboBoxItemType,
          query: result.id,
        };
      });
    }

    const mainResults: any[] =
      availableContextProvidersRef.current
        ?.filter(
          (provider) =>
            provider.title.toLowerCase().startsWith(query.toLowerCase()) ||
            provider.displayTitle.toLowerCase().startsWith(query.toLowerCase()),
        )
        .map((provider) => ({
          name: provider.displayTitle,
          description: provider.description,
          id: provider.title,
          title: provider.displayTitle,
          label: provider.displayTitle,
          renderInlineAs: provider.renderInlineAs,
          type: "contextProvider" as ComboBoxItemType,
          contextProvider: provider,
        }))
        .sort((c, _) => (c.id === "file" ? -1 : 1)) || [];

    if (mainResults.length === 0) {
      const results = getSubmenuContextItemsRef.current(undefined, query);
      return results.map((result) => {
        return {
          ...result,
          label: result.title,
          type: result.providerTitle as ComboBoxItemType,
          query: result.id,
        };
      });
    } else if (
      mainResults.length === availableContextProvidersRef.current.length
    ) {
      mainResults.push({
        title: "Add more context providers",
        type: "action",
        action: () => {
          ideMessenger.request(
            "openUrl",
            "https://docs.continue.dev/customization/context-providers#built-in-context-providers",
          );
        },
        description: "",
      });
    }
    return mainResults;
  };

  return getSuggestion(items, enterSubmenu, onClose, onOpen);
}

export function getCommandSuggestion(
  availableSlashCommandsRef: MutableRefObject<ComboBoxItem[]>,
  onClose: () => void,
  onOpen: () => void,
  ideMessenger: IIdeMessenger,
) {
  const items = async ({ query }) => {
    const options = [
      ...availableSlashCommandsRef.current,
      {
        title: "Build a custom prompt",
        description: "Build a custom prompt",
        type: "action",
        id: "createPromptFile",
        label: "Create Prompt File",
        action: () => {
          console.log("I", ideMessenger.request);
          ideMessenger.request("config/newPromptFile", undefined);
        },
        name: "Create Prompt File",
      },
    ];
    return (
      options.filter((slashCommand) => {
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
      type: (provider.type ?? "slashCommand") as ComboBoxItemType,
      action: provider.action,
    }));
  };
  return getSuggestion(items, undefined, onClose, onOpen);
}
