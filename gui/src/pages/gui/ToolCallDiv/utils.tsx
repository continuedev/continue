import * as Icons from "@heroicons/react/24/outline";
import {
  ContextItem,
  ContextItemWithId,
  ToolCallState,
  ToolStatus,
} from "core";
import { ComponentType, SVGProps } from "react";
import { vscButtonBackground } from "../../../components";
import Spinner from "../../../components/gui/Spinner";
import i18n from "../../../locales/i18n";

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
      return i18n.t("ToolCallDiv.utils.will");
    case "generated":
      return i18n.t("ToolCallDiv.utils.wantsTo");
    case "calling":
      return i18n.t("ToolCallDiv.utils.is");
    case "canceled":
    case "errored":
      return i18n.t("ToolCallDiv.utils.triedTo");
    default:
      return "";
  }
}

// Helper function to get the appropriate verb for group actions
export function getGroupActionVerb(toolCallStates: ToolCallState[]): string {
  if (toolCallStates.length === 0)
    return i18n.t("ToolCallDiv.utils.performing");

  // Get the most "active" status from all tool calls
  const statuses = toolCallStates.map((state) => state.status);

  // Priority order: calling > generating > generated > done > errored/canceled
  if (statuses.includes("calling")) {
    return i18n.t("ToolCallDiv.utils.performing");
  } else if (statuses.includes("generating")) {
    return i18n.t("ToolCallDiv.utils.generating");
  } else if (statuses.includes("generated")) {
    return i18n.t("ToolCallDiv.utils.pending");
  } else if (statuses.some((s) => s === "done")) {
    return i18n.t("ToolCallDiv.utils.performed");
  } else if (statuses.some((s) => s === "errored" || s === "canceled")) {
    return i18n.t("ToolCallDiv.utils.attempted");
  }

  return i18n.t("ToolCallDiv.utils.performing");
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
