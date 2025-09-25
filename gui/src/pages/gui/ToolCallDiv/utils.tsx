import * as Icons from "@heroicons/react/24/outline";
import {
  ContextItem,
  ContextItemWithId,
  ToolCallState,
  ToolStatus,
} from "core";
import { ComponentType, SVGProps } from "react";
import { openContextItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { vscButtonBackground } from "../../../components";
import Spinner from "../../../components/gui/Spinner";

// Helper function to determine the intro verb based on tool call status
export function getStatusIntro(
  status: ToolCallState["status"],
  isInstant?: boolean,
): string {
  if (status === "done" || (isInstant && status === "calling")) {
    return "";
  }

  switch (status) {
    case "generating":
      return "will";
    case "generated":
      return "wants to";
    case "calling":
      return "is";
    case "canceled":
    case "errored":
      return "tried to";
    default:
      return "";
  }
}

// Helper function to get the appropriate verb for group actions
export function getGroupActionVerb(toolCallStates: ToolCallState[]): string {
  if (toolCallStates.length === 0) return "Performing";

  // Get the most "active" status from all tool calls
  const statuses = toolCallStates.map((state) => state.status);

  // Priority order: calling > generating > generated > done > errored/canceled
  if (statuses.includes("calling")) {
    return "Performing";
  } else if (statuses.includes("generating")) {
    return "Generating";
  } else if (statuses.includes("generated")) {
    return "Pending";
  } else if (statuses.some((s) => s === "done")) {
    return "Performed";
  } else if (statuses.some((s) => s === "errored" || s === "canceled")) {
    return "Attempted";
  }

  return "Performing";
}

type IconName = keyof typeof Icons;

type Icon = ComponentType<SVGProps<SVGSVGElement>> | undefined;

export function getIconByName(name: string): Icon | null {
  if (name in Icons) {
    return Icons[name as IconName] as Icon;
  }
  return null;
}

export function getStatusIcon(state: ToolStatus) {
  switch (state) {
    case "generating":
    case "calling":
      return <Spinner />;
    case "generated":
      return <Icons.ArrowRightIcon color={vscButtonBackground} />;
    case "done":
      return <Icons.CheckIcon className="text-success" />;
    case "canceled":
    case "errored":
      return <Icons.XMarkIcon className="text-error" />;
  }
}

export function toolCallStateToContextItems(
  toolCallState: ToolCallState | undefined,
): ContextItemWithId[] {
  if (!toolCallState) {
    return [];
  }
  return (
    toolCallState.output?.map((ctxItem) =>
      toolCallCtxItemToCtxItemWithId(ctxItem, toolCallState.toolCallId),
    ) ?? []
  );
}

export function toolCallCtxItemToCtxItemWithId(
  ctxItem: ContextItem,
  toolCallId: string,
): ContextItemWithId {
  return {
    ...ctxItem,
    id: {
      providerTitle: "toolCall",
      itemId: toolCallId,
    },
  };
}

export function handleToolCallClick(
  toolCallState: ToolCallState,
  ideMessenger: any,
  event?: React.MouseEvent | React.KeyboardEvent,
) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const contextItems = toolCallStateToContextItems(toolCallState);
  if (contextItems.length === 1) {
    // Single context item - open it directly (consistent with SimpleToolCallUI)
    openContextItem(contextItems[0], ideMessenger);
  } else if (contextItems.length > 1) {
    // Multiple context items - show as combined virtual file
    import("core/util/messageContent").then(({ renderContextItems }) => {
      ideMessenger.post("showVirtualFile", {
        name: "Tool Output",
        content: renderContextItems(toolCallState.output!),
      });
    });
  }
}
