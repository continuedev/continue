import { JSONContent } from "@tiptap/react";
import { InputModifiers } from "core";

/**
 * Several messages queued while the agent worked are sent as one message, so
 * quick follow-ups make one turn instead of several. Paragraphs, mentions and
 * images keep their order; the last message's modifiers win.
 */
export function mergeQueuedMessages(
  messages: { editorState: JSONContent; modifiers: InputModifiers }[],
): { editorState: JSONContent; modifiers: InputModifiers } | undefined {
  if (messages.length === 0) return undefined;
  if (messages.length === 1) return messages[0];
  return {
    editorState: {
      type: "doc",
      content: messages.flatMap((m) => m.editorState.content ?? []),
    },
    modifiers: messages[messages.length - 1].modifiers,
  };
}

/** One-line text of a queued message: text and @-mention labels, no images. */
export function queuedMessagePreview(editorState: JSONContent): string {
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    } else if (node.type === "mention") {
      parts.push(`@${node.attrs?.label ?? node.attrs?.id ?? ""}`);
    } else if (node.type === "image") {
      parts.push("[image]");
    }
    for (const child of node.content ?? []) walk(child);
    if (node.type === "paragraph" || node.type === "codeBlock") {
      parts.push(" ");
    }
  };
  walk(editorState);
  return parts.join("").replace(/\s+/g, " ").trim();
}
