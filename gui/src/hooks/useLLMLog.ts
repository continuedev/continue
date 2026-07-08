import {
  LLMInteractionCancel,
  LLMInteractionChunk,
  LLMInteractionError,
  LLMInteractionItem,
  LLMInteractionMessage,
  LLMInteractionStartChat,
  LLMInteractionStartComplete,
  LLMInteractionStartFim,
  LLMInteractionSuccess,
} from "core";
import { useEffect, useReducer } from "react";
import { v4 as uuidv4 } from "uuid";

declare const vscode: any;

export type LLMResult = LLMInteractionMessage | LLMInteractionChunk;

const MAX_GROUP_LENGTH = 32;

interface ToConsoleViewInit {
  type: "init";
  uuid: string;
  items: LLMInteractionItem[];
}

interface ToConsoleViewItem {
  type: "item";
  uuid: string;
  item: LLMInteractionItem;
}

interface ToConsoleViewRemove {
  type: "remove";
  uuid: string;
  interactionId: string;
}

interface ToConsoleViewClear {
  type: "clear";
  uuid: string;
}

type ToConsoleView =
  | ToConsoleViewInit
  | ToConsoleViewItem
  | ToConsoleViewRemove
  | ToConsoleViewClear;

/**
 * Represents a linear list of LLMInteractionItem, transformed into
 * a form that is more convenient for rendering.
 */
export interface LLMInteraction {
  start?:
    | LLMInteractionStartChat
    | LLMInteractionStartComplete
    | LLMInteractionStartFim;

  // We use an array-of-arrays for efficiency when rendering a streamed result
  // with lots and lots of separate tokens; instead of having a linear list
  // of 1024 Result components, we have 32 ResultGroup components each rendering
  // 32 Results.
  //
  // Inline content can split between one group and the next - we'll let the
  // browser engine sort that out.
  results: LLMResult[][];

  end?: LLMInteractionSuccess | LLMInteractionError | LLMInteractionCancel;
}

export interface LLMLog {
  loading: boolean;
  interactions: Map<string, LLMInteraction>;
  order: string[];
}

/**
 * Appends a new result item (chunk or message) to an interaction,
 * existing iteractions must already have been copied with
 * copyInteractionForMutation().
 */
function appendItemToInteractionResult(
  interaction: LLMInteraction,
  item: LLMInteractionMessage | LLMInteractionChunk,
) {
  let lastGroup = interaction.results[interaction.results.length - 1];

  if (lastGroup == undefined || lastGroup.length == MAX_GROUP_LENGTH) {
    interaction.results.push([item]);
  } else {
    lastGroup.push(item);
  }
}

/**
 * Makes a copy of an interaction that can be mutated without changing
 * any objects/arrays that are part of the old state. We always make
 * a copy of the last (open) result group, so that we can simply append
 * to it; this is very slightly inefficient for the case where we're
 * handling a single end item with no results, but makes things simpler.
 */
function copyInteractionForMutation(oldInteraction: LLMInteraction) {
  const oldResults = oldInteraction.results;
  let oldLastGroup = oldInteraction.results[oldInteraction.results.length - 1];
  let newResults;

  if (oldLastGroup == undefined || oldLastGroup.length == MAX_GROUP_LENGTH) {
    newResults = [...oldInteraction.results];
  } else {
    newResults = oldInteraction.results.slice(0, -1);
    newResults.push([...oldLastGroup]);
  }

  return { ...oldInteraction, results: newResults };
}

function appendItemsToLLMLog(
  oldLog: LLMLog,
  items: LLMInteractionItem[],
): LLMLog {
  const oldInteractions = oldLog.interactions;
  const newInteractions: Map<string, LLMInteraction> = new Map();
  let order = oldLog.order;
  let interactionsAdded = false;

  // Add the new items to the log, making mutable copies of old
  // LLMInteraction as necessary
  for (const item of items) {
    let interaction = newInteractions.get(item.interactionId);
    if (interaction === undefined) {
      const oldInteraction = oldInteractions.get(item.interactionId);
      if (oldInteraction) {
        interaction = copyInteractionForMutation(oldInteraction);
      } else {
        interaction = {
          results: [],
        };

        if (interactionsAdded) {
          order.push(item.interactionId);
        } else {
          order = [...order, item.interactionId];
          interactionsAdded = true;
        }
      }
      newInteractions.set(item.interactionId, interaction);
    }

    switch (item.kind) {
      case "startChat":
      case "startComplete":
      case "startFim":
        interaction.start = item;
        break;
      case "chunk":
      case "message":
        appendItemToInteractionResult(interaction, item);
        break;
      case "success":
      case "error":
      case "cancel":
        interaction.end = item;
        break;
    }
  }

  // Copy over unchanged interactions
  for (const interactionId of oldInteractions.keys()) {
    if (!newInteractions.has(interactionId)) {
      newInteractions.set(interactionId, oldInteractions.get(interactionId)!);
    }
  }

  return {
    loading: false,
    interactions: newInteractions,
    order,
  };
}

function removeInteractionFromLLMLog(
  llmLog: LLMLog,
  interactionId: string,
): LLMLog {
  const newInteractions = new Map(llmLog.interactions);
  newInteractions.delete(interactionId);
  const newOrder = llmLog.order.filter((id) => id !== interactionId);

  return {
    loading: false,
    interactions: newInteractions,
    order: newOrder,
  };
}

/**
 * Hook to accumulate log data structures based on messages passed
 * from the core. Note that each call site will create an independent
 * data structure, so this should be only used once at a toplevel
 * component.
 * @returns currently log datastructure.
 */
export default function useLLMLog() {
  const [llmLog, dispatchLlmLog] = useReducer(
    (llmLog: LLMLog, message: ToConsoleView) => {
      switch (message.type) {
        case "init":
          return appendItemsToLLMLog(llmLog, message.items);
        case "item":
          return appendItemsToLLMLog(llmLog, [message.item]);
        case "remove":
          return removeInteractionFromLLMLog(llmLog, message.interactionId);
        case "clear":
          return {
            loading: false,
            interactions: new Map(),
            order: [],
          };
      }
    },
    {
      loading: true,
      interactions: new Map(),
      order: [],
    },
  );

  useEffect(function () {
    // The uuid here marks the "generation" when the webview is
    // reloaded, so we don't get confused if there are inflight
    // messages from the previous generation. In particular, this
    // avoids problems when React.StrictMode runs this effect
    // twice - we don't want to process two "init" messages.
    const uuid = uuidv4();
    const onMessage = (event: MessageEvent<ToConsoleView>) => {
      if (event.data.uuid !== uuid) {
        return;
      }

      dispatchLlmLog(event.data);
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "start", uuid });

    return () => {
      vscode.postMessage({ type: "stop", uuid });
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return llmLog;
}
