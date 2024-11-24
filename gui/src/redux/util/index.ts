import { ToolCallState } from "core";
import { RootState } from "../store";

function findLast<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => boolean,
): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return array[i];
    }
  }
  return undefined;
}

export function findLastToolCall(
  state: RootState["state"]["history"],
): ToolCallState | undefined {
  return findLast(state, (item) => !!item.toolCallState)?.toolCallState;
}
