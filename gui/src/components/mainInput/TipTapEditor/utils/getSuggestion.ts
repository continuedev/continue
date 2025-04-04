import { Editor, ReactRenderer } from "@tiptap/react";
import {
  ContextProviderDescription,
  ContextSubmenuItem,
  ContextSubmenuItemWithProvider,
} from "core";
import { MutableRefObject } from "react";
import tippy from "tippy.js";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { AppDispatch } from "../../../../redux/store";
import AtMentionDropdown from "../../AtMentionDropdown";
import { ComboBoxItem, ComboBoxItemType, ComboBoxSubAction } from "../../types";
import { TIPPY_DIV_ID } from "../TipTapEditor";
import { SlashCommand } from "../extensions";

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
      let component: any;
      let popup: any;

      const onExit = () => {
        popup?.[0]?.destroy();
        component?.destroy();
        onClose();
      };

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(AtMentionDropdown, {
            props: { ...props, enterSubmenu, onClose: onExit },
            editor: props.editor,
          });

          if (!props.clientRect) {
            console.log("no client rect");
            return;
          }

          const container = document.getElementById(TIPPY_DIV_ID);

          if (!container) {
            console.log("no container");
            return;
          }

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => container,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            maxWidth: `${window.innerWidth - 24}px`,
          });

          onOpen();
        },

        onUpdate(props: any) {
          component.updateProps({ ...props, enterSubmenu });

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props: any) {
          if (props.event.key === "Escape") {
            popup[0].hide();

            return true;
          }

          return component.ref?.onKeyDown(props);
        },

        onExit,
      };
    },
  };
}

function getSubActionsForSubmenuItem(
  item: ContextSubmenuItem & { providerTitle: string },
  ideMessenger: IIdeMessenger,
): ComboBoxSubAction[] | undefined {
  if (item.providerTitle === "docs") {
    return [
      {
        label: "Open in new tab",
        icon: "trash",
        action: () => {
          ideMessenger.post("context/removeDocs", { startUrl: item.id });
        },
      },
    ];
  }

  return undefined;
}

export function getContextProviderDropdownOptions(
  availableContextProvidersRef: MutableRefObject<ContextProviderDescription[]>,
  getSubmenuContextItemsRef: MutableRefObject<
    (
      providerTitle: string | undefined,
      query: string,
    ) => ContextSubmenuItemWithProvider[]
  >,
  enterSubmenu: (editor: Editor, providerId: string) => void,
  onClose: () => void,
  onOpen: () => void,
  inSubmenu: MutableRefObject<string | undefined>,
  ideMessenger: IIdeMessenger,
) {
  const items = async ({ query }: { query: string }) => {
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
          subActions: getSubActionsForSubmenuItem(result, ideMessenger),
        };
      });
    }

    const contextProviderMatches: ComboBoxItem[] =
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

    if (contextProviderMatches.length) {
      contextProviderMatches.push({
        title: "Add more context providers",
        type: "action",
        action: () => {
          ideMessenger.post(
            "openUrl",
            "https://docs.continue.dev/customization/context-providers#built-in-context-providers",
          );
        },
        description: "",
      });
      return contextProviderMatches;
    }

    // No provider matches -> search all providers
    const results = getSubmenuContextItemsRef.current(undefined, query);
    return results.map((result) => {
      return {
        ...result,
        label: result.title,
        type: result.providerTitle as ComboBoxItemType,
        query: result.id,
        icon: result.icon,
      };
    });
  };

  return getSuggestion(items, enterSubmenu, onClose, onOpen);
}

export function getSlashCommandDropdownOptions(
  availableSlashCommandsRef: MutableRefObject<ComboBoxItem[]>,
  onClose: () => void,
  onOpen: () => void,
  ideMessenger: IIdeMessenger,
  dispatch: AppDispatch,
  inputId: string,
) {
  const items = async ({ query }: { query: string }) => {
    const options = [...availableSlashCommandsRef.current];

    const filteredCommands =
      query.length > 0
        ? options.filter((slashCommand) => {
            const sc = slashCommand.title.toLowerCase();
            const iv = query.toLowerCase();
            return sc.startsWith(iv);
          })
        : options;

    const commandItems = (filteredCommands || []).map((provider) => ({
      name: provider.title,
      description: provider.description,
      id: provider.title,
      title: provider.title,
      label: provider.title,
      type: (provider.type ?? SlashCommand.name) as ComboBoxItemType,
      content: provider.content,
      action: provider.action,
    }));

    if (query.length === 0 && commandItems.length === 0) {
      commandItems.push({
        title: "Explore prompts",
        type: "action",
        action: () =>
          ideMessenger.post(
            "openUrl",
            "https://hub.continue.dev/explore/prompts",
          ),
        description: "",
        name: "",
        id: "",
        label: "",
        content: "",
      });
    }

    return commandItems;
  };
  return getSuggestion(items, undefined, onClose, onOpen);
}
