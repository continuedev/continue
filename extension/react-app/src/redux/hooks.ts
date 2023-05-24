import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "./store";
import { selectDebugContextValue } from "./selectors/debugContextSelectors";
import { updateValue } from "./slices/debugContexSlice";
import { SerializedDebugContext } from "../../../src/client";

export function useDebugContextValue(
  key: keyof SerializedDebugContext,
  defaultValue: any
): [any, (value: any) => void] {
  const dispatch = useDispatch();
  const state =
    useSelector((state: RootStore) => selectDebugContextValue(state, key)) ||
    defaultValue;
  const boundAction = useCallback(
    (value: any) => dispatch(updateValue({ key, value })),
    [dispatch, key]
  );
  return [state, boundAction];
}
