import { RootStore } from "../store";

const selectDebugContext = (state: RootStore) => {
  return {
    ...state.debugState.debugContext,
    rangesInFiles: state.debugState.debugContext.rangesInFiles.filter(
      (_, index) => state.debugState.rangesMask[index]
    ),
  };
};

const selectAllRangesInFiles = (state: RootStore) => {
  return state.debugState.debugContext.rangesInFiles;
};

const selectRangesMask = (state: RootStore) => {
  return state.debugState.rangesMask;
};

const selectDebugContextValue = (state: RootStore, key: string) => {
  return (state.debugState.debugContext as any)[key];
};

export {
  selectDebugContext,
  selectDebugContextValue,
  selectAllRangesInFiles,
  selectRangesMask,
};
