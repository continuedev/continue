import {
  CheckIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ContextItem, ToolCallState } from "core";
import { useState } from "react";
import Spinner from "../../../components/gui/Spinner";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";
import { ToggleWithIcon } from "./ToggleWithIcon";

interface SubagentToolCallProps {
  toolCallState: ToolCallState;
  historyIndex: number;
}

/**
 * One card per delegated task. Each subagent's ContextItem is refreshed live
 * through toolCallPartialOutput while it runs, so `status` and `content` here
 * are a running view, not just a final result.
 */
export function SubagentToolCall({
  toolCallState,
  historyIndex,
}: SubagentToolCallProps) {
  const items = Array.isArray(toolCallState.output) ? toolCallState.output : [];

  // Before any output arrives, fall back to the streamed args so the user sees
  // the tasks as soon as the model has named them. These args come from
  // incrementalParseJson, so mid-stream `tasks` may still be a partial string
  // or object rather than an array, and individual entries may lack fields.
  const streamedTasks = toolCallState.parsedArgs?.tasks;
  const pendingTasks: ContextItem[] =
    items.length > 0
      ? items
      : (Array.isArray(streamedTasks) ? streamedTasks : [])
          .filter(
            (t: any) => t && typeof t.description === "string" && t.description,
          )
          .map((t: any) => ({
            name: t.description,
            description: "Starting",
            content: "",
            status: "running",
          }));

  if (pendingTasks.length === 0) {
    return (
      <div className="text-description px-1 py-1 text-xs">
        Preparing subagents…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="text-description flex items-center gap-1.5 text-xs">
        <UserGroupIcon className="h-4 w-4" />
        {pendingTasks.length === 1
          ? "1 subagent"
          : `${pendingTasks.length} subagents`}
      </div>
      {pendingTasks.map((item, index) => (
        <SubagentRow
          key={`${historyIndex}-${index}-${item.name}`}
          item={item}
        />
      ))}
    </div>
  );
}

function statusIcon(status: string | undefined) {
  switch (status) {
    case "done":
      return <CheckIcon className="text-success h-4 w-4" />;
    case "errored":
    case "canceled":
      return <XMarkIcon className="text-error h-4 w-4" />;
    default:
      return <Spinner />;
  }
}

function SubagentRow({ item }: { item: ContextItem }) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(item.content?.trim());

  return (
    <div className="border-vsc-input-border rounded border">
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 ${
          hasBody ? "cursor-pointer hover:brightness-125" : ""
        }`}
        onClick={hasBody ? () => setOpen(!open) : undefined}
      >
        <ToggleWithIcon
          isToggleable={hasBody}
          open={open}
          onClick={() => setOpen(!open)}
        />
        <div className="flex-1 truncate text-xs">{item.name}</div>
        <div className="text-description shrink-0 text-xs">
          {item.description}
        </div>
        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          {statusIcon(item.status)}
        </div>
      </div>
      {open && hasBody && (
        <div className="border-vsc-input-border max-h-[40vh] overflow-y-auto border-t px-2 py-1">
          <StyledMarkdownPreview source={item.content} />
        </div>
      )}
    </div>
  );
}
