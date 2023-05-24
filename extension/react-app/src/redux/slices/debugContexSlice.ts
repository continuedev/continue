import { createSlice } from "@reduxjs/toolkit";
import { RangeInFile, SerializedDebugContext } from "../../../../src/client";
import { RootStore } from "../store";

export const debugStateSlice = createSlice({
  name: "debugState",
  initialState: {
    debugContext: {
      rangesInFiles: [],
      filesystem: {},
      traceback: undefined,
      description: undefined,
    },
    rangesMask: [],
  } as RootStore["debugState"],
  reducers: {
    updateValue: (
      state: RootStore["debugState"],
      action: {
        type: string;
        payload: { key: keyof SerializedDebugContext; value: any };
      }
    ) => {
      return {
        ...state,
        debugContext: {
          ...state.debugContext,
          [action.payload.key]: action.payload.value,
        },
      };
    },
    addRangeInFile: (
      state: RootStore["debugState"],
      action: {
        type: string;
        payload: {
          rangeInFile: RangeInFile;
          canUpdateLast: boolean;
        };
      }
    ) => {
      let rangesInFiles = state.debugContext.rangesInFiles;
      // If identical to existing range, don't add. Ideally you check for overlap of ranges.
      for (let range of rangesInFiles) {
        if (
          range.filepath === action.payload.rangeInFile.filepath &&
          range.range.start.line ===
            action.payload.rangeInFile.range.start.line &&
          range.range.end.line === action.payload.rangeInFile.range.end.line
        ) {
          return state;
        }
      }

      if (
        action.payload.canUpdateLast &&
        rangesInFiles.length > 0 &&
        rangesInFiles[rangesInFiles.length - 1].filepath ===
          action.payload.rangeInFile.filepath
      ) {
        return {
          ...state,
          debugContext: {
            ...state.debugContext,
            rangesInFiles: [
              ...rangesInFiles.slice(0, rangesInFiles.length - 1),
              action.payload.rangeInFile,
            ],
          },
        };
      } else {
        return {
          ...state,
          debugContext: {
            ...state.debugContext,
            rangesInFiles: [
              ...state.debugContext.rangesInFiles,
              action.payload.rangeInFile,
            ],
          },
          rangesMask: [...state.rangesMask, true],
        };
      }
    },
    deleteRangeInFileAt: (
      state: RootStore["debugState"],
      action: {
        type: string;
        payload: number;
      }
    ) => {
      return {
        ...state,
        debugContext: {
          ...state.debugContext,
          rangesInFiles: state.debugContext.rangesInFiles.filter(
            (_, index) => index !== action.payload
          ),
        },
        rangesMask: state.rangesMask.filter(
          (_, index) => index !== action.payload
        ),
      };
    },
    toggleSelectionAt: (
      state: RootStore["debugState"],
      action: {
        type: string;
        payload: number;
      }
    ) => {
      return {
        ...state,
        rangesMask: state.rangesMask.map((_, index) =>
          index === action.payload
            ? !state.rangesMask[index]
            : state.rangesMask[index]
        ),
      };
    },
    updateFileSystem: (
      state: RootStore["debugState"],
      action: {
        type: string;
        payload: { [filepath: string]: string };
      }
    ) => {
      return {
        ...state,
        debugContext: {
          ...state.debugContext,
          filesystem: {
            ...state.debugContext.filesystem,
            ...action.payload,
          },
        },
      };
    },
  },
});

export const {
  updateValue,
  updateFileSystem,
  addRangeInFile,
  deleteRangeInFileAt,
  toggleSelectionAt,
} = debugStateSlice.actions;
export default debugStateSlice.reducer;
