import { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { SuggestionOptions } from "@tiptap/suggestion";

export type MentionOptions = {
  HTMLAttributes: Record<string, any>;
  renderHTML: (props: {
    options: MentionOptions;
    node: ProseMirrorNode;
  }) => DOMOutputSpec;
  suggestion: Omit<SuggestionOptions, "editor">;
};
