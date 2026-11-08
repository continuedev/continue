import {
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperAirplaneIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useRef, useState } from "react";
import { useAppSelector } from "../../redux/hooks";
import { selectCurrentToolCalls } from "../../redux/selectors/selectToolCalls";
import { QueuedMessage } from "../../redux/slices/sessionSlice";
import { queuedMessagePreview } from "./util/queuedMessages";

interface QueuedMessagesProps {
  /**
   * Send these now. While the agent works they are delivered after the
   * running tool calls finish (steering), without stopping the turn.
   */
  onSendNow: (ids: string[]) => void;
  /**
   * Steer now: end the model's reply where it is and send these at once.
   * Offered only while the model writes; a running tool always finishes.
   */
  onSteerNow?: (ids: string[]) => void;
  /** Move the message back into the input for editing */
  onEdit: (message: QueuedMessage) => void;
  onRemove: (id: string) => void;
  /** Move a message to position `to` (0-based): the order they are sent in */
  onMove: (id: string, to: number) => void;
}

/**
 * Messages typed while the agent was working, shown above the input in the
 * order they will be sent. They go as one message when the turn ends, or
 * after the running tool calls with "Send now"; after Stop, an error or a new
 * session they wait until sent by hand.
 */
export function QueuedMessages(props: QueuedMessagesProps) {
  const queued = useAppSelector((s) => s.session.queuedMessages);
  const isPaused = useAppSelector((s) => s.session.isQueuePaused);
  const isStreaming = useAppSelector((s) => s.session.isStreaming);
  // Nothing streams while an approved tool runs, but the agent is working
  const isToolRunning = useAppSelector((s) =>
    selectCurrentToolCalls(s).some((tc) => tc.status === "calling"),
  );
  const isWorking = isStreaming || isToolRunning;
  // Only the model's own writing is cut short, never a running tool
  const canSteerNow = !!props.onSteerNow && isStreaming && !isToolRunning;
  // Drag to reorder: the message being dragged (a ref, so handlers of the
  // same gesture see it before React re-renders), and the row it is over
  const dragRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (queued.length === 0) return null;
  const canReorder = queued.length > 1;
  const endDrag = () => {
    dragRef.current = null;
    setDragId(null);
    setDropIndex(null);
  };

  const steered = queued.filter((m) => m.steer).length;
  const sendNowTitle = isWorking
    ? "Send after the running tool calls, in this turn"
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
            : steered === queued.length
              ? `${queued.length} queued, sent after the running tools`
              : `${queued.length} queued, sent when this turn ends`}
        </span>
        {isPaused && !isWorking && (
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
          draggable={canReorder}
          onDragStart={(e) => {
            dragRef.current = message.id;
            setDragId(message.id);
            e.dataTransfer?.setData("text/plain", message.id);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (!dragRef.current) return;
            e.preventDefault();
            setDropIndex(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragRef.current) props.onMove(dragRef.current, i);
            endDrag();
          }}
          onDragEnd={endDrag}
          className={`group flex min-w-0 items-center gap-1.5 text-foreground ${
            canReorder ? "cursor-grab" : ""
          } ${dragId === message.id ? "opacity-50" : ""} ${
            dropIndex === i && dragId !== message.id
              ? "rounded outline outline-1 outline-border"
              : ""
          }`}
        >
          <span className="shrink-0 text-description-muted">{i + 1}.</span>
          <span className="line-clamp-1 min-w-0 flex-1 wrap-anywhere">
            {queuedMessagePreview(message.editorState) || "(empty)"}
          </span>
          {message.steer && (
            <span
              data-testid="queued-message-steer"
              title="Sent after the running tool calls finish"
              className="shrink-0 text-description-muted"
            >
              next
            </span>
          )}
          {canReorder &&
            (i > 0 ? (
              <QueueButton
                testId="queued-message-move-up"
                title="Move up: send earlier"
                onClick={() => props.onMove(message.id, i - 1)}
              >
                <ChevronUpIcon className="h-3.5 w-3.5" />
              </QueueButton>
            ) : (
              <ButtonSpace />
            ))}
          {canReorder &&
            (i < queued.length - 1 ? (
              <QueueButton
                testId="queued-message-move-down"
                title="Move down: send later"
                onClick={() => props.onMove(message.id, i + 1)}
              >
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </QueueButton>
            ) : (
              <ButtonSpace />
            ))}
          <QueueButton
            testId="queued-message-edit"
            title="Edit: move back into the input"
            onClick={() => props.onEdit(message)}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </QueueButton>
          {canSteerNow && (
            <QueueButton
              testId="queued-message-steer-now"
              title="Steer now: stop the reply here and send this"
              onClick={() => props.onSteerNow?.([message.id])}
            >
              <BoltIcon className="h-3.5 w-3.5" />
            </QueueButton>
          )}
          {!message.steer && (
            <QueueButton
              testId="queued-message-send"
              title={sendNowTitle}
              onClick={() => props.onSendNow([message.id])}
            >
              <PaperAirplaneIcon className="h-3.5 w-3.5" />
            </QueueButton>
          )}
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

/** Holds a missing button's place, so the buttons line up across rows */
function ButtonSpace() {
  return <span aria-hidden className="w-[18px] shrink-0" />;
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
