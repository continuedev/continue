import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { stableStringify } from "core/tools/permissions/auto/state";

/** A tool call that was refused this session, for the "Recently blocked" list. */
export interface BlockedCall {
  /** The tool call id; also the key of the list entry. */
  id: string;
  toolName: string;
  /** The command or path, or the tool name when there is none. */
  summary: string;
  /** Who refused it: a rule, the safety check, a switched-off tool, or Auto. */
  source: string;
  reason?: string;
  /** The reviewer's category, for Auto refusals. */
  category?: string;
  /** The args, kept only to build the allow-once key. */
  parsedArgs: Record<string, unknown>;
  /** The user allowed this exact call once. */
  allowedOnce?: boolean;
  at: number;
}

export interface BlockedCallsState {
  items: BlockedCall[];
  /** Keys of exact calls the user allowed once; each is used up by one call. */
  grants: string[];
}

const MAX_ITEMS = 50;

export const initialBlockedCalls: BlockedCallsState = {
  items: [],
  grants: [],
};

/** Same tool and same arguments. */
export function grantKey(toolName: string, args: unknown): string {
  return `${toolName}\u0000${stableStringify(args)}`;
}

/**
 * Only a refusal by the reviewer model can be allowed once. A deny rule, a
 * protected path, a command the safety check refuses and a tool the user
 * switched off are the user's own deterministic limits; the way past them is
 * to change the rule or setting, not a click on a list.
 */
export function canAllowOnce(item: Pick<BlockedCall, "source">): boolean {
  return item.source === "auto";
}

/**
 * In memory only, never persisted (it is not in the store's saved subsets):
 * the list can contain commands and paths from the conversation.
 */
export const blockedCallsSlice = createSlice({
  name: "blockedCalls",
  initialState: initialBlockedCalls,
  reducers: {
    addBlockedCall: (state, { payload }: PayloadAction<BlockedCall>) => {
      state.items = [
        payload,
        ...state.items.filter((i) => i.id !== payload.id),
      ].slice(0, MAX_ITEMS);
    },
    allowBlockedOnce: (state, { payload }: PayloadAction<string>) => {
      const item = state.items.find((i) => i.id === payload);
      if (!item || !canAllowOnce(item) || item.allowedOnce) return;
      item.allowedOnce = true;
      state.grants.push(grantKey(item.toolName, item.parsedArgs));
    },
    consumeGrant: (state, { payload }: PayloadAction<string>) => {
      const i = state.grants.indexOf(payload);
      if (i >= 0) state.grants.splice(i, 1);
    },
    clearBlockedCalls: () => initialBlockedCalls,
  },
});

export const {
  addBlockedCall,
  allowBlockedOnce,
  consumeGrant,
  clearBlockedCalls,
} = blockedCallsSlice.actions;

export default blockedCallsSlice.reducer;
