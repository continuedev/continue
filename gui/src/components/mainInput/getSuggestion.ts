import { ReactRenderer } from "@tiptap/react";
import { IContextProvider } from "core";
import tippy from "tippy.js";
import MentionList from "./MentionList";
import { ComboBoxItem } from "./types";

function getSuggestion(items: (props: { query: string }) => ComboBoxItem[]) {
  return {
    items,
    render: () => {
      let component;
      let popup;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props,
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
        },

        onUpdate(props) {
          component.updateProps(props);

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
        },
      };
    },
  };
}

export function getMentionSuggestion(
  availableContextProviders: IContextProvider[]
) {
  const items = ({ query }) => {
    return (
      availableContextProviders
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
        }))
        .sort((c, _) => (c.id === "file" ? -1 : 1)) || []
    );
  };
  return getSuggestion(items);
}

export function getCommandSuggestion(availableSlashCommands: ComboBoxItem[]) {
  const items = ({ query }) => {
    return (
      availableSlashCommands?.filter((slashCommand) => {
        const sc = slashCommand.title.toLowerCase();
        const iv = query.toLowerCase();
        return sc.startsWith(iv) && sc !== iv;
      }) || []
    ).map((provider) => ({
      name: provider.title,
      description: provider.description,
      id: provider.title,
      title: provider.title,
      label: provider.title,
    }));
  };
  return getSuggestion(items);
}
