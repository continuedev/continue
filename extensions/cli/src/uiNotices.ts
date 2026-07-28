import type { ChatHistoryItem } from "core/index.js";

/**
 * Messages the TUI appends to the history purely to tell the user something
 * happened — "Switched to model: …", "Failed to switch model: …", config
 * notices. They are given `role: "system"` because that is what the renderer
 * keys off, but they are not system instructions for the model.
 *
 * `spec/wire-format.md` already defines a `messageType` discriminator for
 * exactly this, and the selector hooks already set `messageType: "system"`.
 * Nothing read it, so once a notice was in the history it was indistinguishable
 * from a real system message, and the conversion to wire format sent it to the
 * provider as a second `role: "system"` at a non-zero index — which providers
 * reject with "System message must be at the beginning".
 */
export type UiMessageType =
  | "tool-start"
  | "tool-result"
  | "tool-error"
  | "system";

/**
 * A history item that carries the `messageType` discriminator from
 * `spec/wire-format.md`. The field is CLI-local: `ChatHistoryItem` is a core
 * type shared with the extensions, and this classification only means anything
 * to the TUI.
 */
export type ChatHistoryItemWithType = ChatHistoryItem & {
  messageType?: UiMessageType;
};

/**
 * True when the item is a UI notice rather than part of the conversation.
 *
 * Only `messageType` is consulted, never `role`: a real system message and a
 * notice both use `role: "system"`, which is precisely why the discriminator
 * exists.
 */
export function isUiNotice(item: ChatHistoryItem): boolean {
  return (item as ChatHistoryItemWithType).messageType === "system";
}

/**
 * Drop UI notices before the history is converted to wire format, so they stay
 * visible in the transcript but are never sent to the model.
 */
export function withoutUiNotices(
  history: ChatHistoryItem[],
): ChatHistoryItem[] {
  return history.filter((item) => !isUiNotice(item));
}
