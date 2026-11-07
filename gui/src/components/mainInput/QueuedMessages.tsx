import {
  PaperAirplaneIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector } from "../../redux/hooks";
import { QueuedMessage } from "../../redux/slices/sessionSlice";
import { queuedMessagePreview } from "./util/queuedMessages";

interface QueuedMessagesProps {
  /** Send these now; while the agent works this stops the current turn first */
  onSendNow: (ids: string[]) => void;
  /** Move the message back into the input for editing */
  onEdit: (message: QueuedMessage) => void;
  onRemove: (id: string) => void;
}

/**
 * Messages typed while the agent was working, shown above the input in the
 * order they will be sent. They go as one message when the turn ends; after
 * Stop, an error or a new session they wait until sent by hand.
 */
export function QueuedMessages(props: QueuedMessagesProps) {
  const queued = useAppSelector((s) => s.session.queuedMessages);
  const isPaused = useAppSelector((s) => s.session.isQueuePaused);
  const isStreaming = useAppSelector((s) => s.session.isStreaming);

  if (queued.length === 0) return null;

  const sendNowTitle = isStreaming
    ? "Stop the current response and send this now"
    : "Send this now";

  return (
    <div
      data-testid="queued-messages"
      className="mx-1 mb-1 flex flex-col gap-0.5 rounded border border-solid border-border px-2 py-1 text-xs"
    >
      <div className="flex items-center gap-2 text-description">
        <span>
          {isPaused
            ? `${queued.length} queued, paused`
            : `${queued.length} queued, sent when this turn ends`}
        </span>
        {isPaused && !isStreaming && (
          <button
            type="button"
            data-testid="queued-messages-send-all"
            onClick={() => props.onSendNow(queued.map((m) => m.id))}
            className="ml-auto cursor-pointer border-none bg-transparent p-0 text-xs text-link underline hover:brightness-125"
          >
            Send {queued.length > 1 ? "all as one message" : "now"}
          </button>
        )}
      </div>
      {queued.map((message, i) => (
        <div
          key={message.id}
          data-testid="queued-message"
          className="group flex min-w-0 items-center gap-1.5 text-foreground"
        >
          <span className="shrink-0 text-description-muted">{i + 1}.</span>
          <span className="line-clamp-1 min-w-0 flex-1 wrap-anywhere">
            {queuedMessagePreview(message.editorState) || "(empty)"}
          </span>
          <QueueButton
            testId="queued-message-edit"
            title="Edit: move back into the input"
            onClick={() => props.onEdit(message)}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </QueueButton>
          <QueueButton
            testId="queued-message-send"
            title={sendNowTitle}
            onClick={() => props.onSendNow([message.id])}
          >
            <PaperAirplaneIcon className="h-3.5 w-3.5" />
          </QueueButton>
          <QueueButton
            testId="queued-message-remove"
            title="Remove from the queue"
            onClick={() => props.onRemove(message.id)}
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </QueueButton>
        </div>
      ))}
    </div>
  );
}

function QueueButton(props: {
  testId: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={props.testId}
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
      className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-0.5 text-description-muted hover:text-foreground"
    >
      {props.children}
    </button>
  );
}
