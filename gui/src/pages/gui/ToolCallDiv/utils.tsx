import {
  ArrowRightIcon,
  CheckIcon,
  CodeBracketIcon,
  DocumentIcon,
  DocumentTextIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  MapIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  ContextItem,
  ContextItemWithId,
  ToolCallState,
  ToolStatus,
} from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ComponentType } from "react";
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
      return "is generating output to";
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

export const toolCallIcons: Record<string, ComponentType> = {
  [BuiltInToolNames.FileGlobSearch]: MagnifyingGlassIcon,
  [BuiltInToolNames.GrepSearch]: MagnifyingGlassIcon,
  [BuiltInToolNames.LSTool]: FolderIcon,
  [BuiltInToolNames.ReadCurrentlyOpenFile]: DocumentTextIcon,
  [BuiltInToolNames.ReadFile]: DocumentIcon,
  [BuiltInToolNames.FetchUrlContent]: GlobeAltIcon,
  [BuiltInToolNames.SearchWeb]: GlobeAltIcon,
  [BuiltInToolNames.ViewDiff]: CodeBracketIcon,
  [BuiltInToolNames.ViewRepoMap]: MapIcon,
  [BuiltInToolNames.ViewSubdirectory]: FolderOpenIcon,
  [BuiltInToolNames.CreateRuleBlock]: PencilIcon,
};

export function getStatusIcon(state: ToolStatus) {
  switch (state) {
    case "generating":
    case "calling":
      return <Spinner />;
    case "generated":
      return <ArrowRightIcon color={vscButtonBackground} />;
    case "done":
      return <CheckIcon className="text-success" />;
    case "canceled":
    case "errored":
      return <XMarkIcon className="text-error" />;
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
