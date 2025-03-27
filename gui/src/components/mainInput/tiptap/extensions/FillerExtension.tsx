import { Node } from "@tiptap/core";

export const MockExtension = Node.create({
  name: "mockExtension",

  addOptions() {
    return {
      enabled: false,
    };
  },
  addCommands() {
    return {};
  },
  addKeyboardShortcuts() {
    return {};
  },
  addProseMirrorPlugins() {
    return [];
  },
});
