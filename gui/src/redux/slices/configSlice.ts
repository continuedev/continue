import { createSlice } from "@reduxjs/toolkit";
import { RootStore } from "../store";

const windowAny: any = window;

export const configSlice = createSlice({
  name: "config",
  initialState: {
    apiUrl: windowAny.serverUrl || "http://localhost:8000",
    workspacePaths: windowAny.workspacePaths || [],
    vscMachineId: windowAny.vscMachineId || undefined,
  } as RootStore["config"],
  reducers: {
    setWorkspacePaths: (
      state: RootStore["config"],
      action: { type: string; payload: string[] }
    ) => {
      return {
        ...state,
        workspacePaths: action.payload,
      };
    },
    setApiUrl: (
      state: RootStore["config"],
      action: { type: string; payload: string }
    ) => ({
      ...state,
      apiUrl: action.payload,
    }),
    setVscMachineId: (
      state: RootStore["config"],
      action: { type: string; payload: string }
    ) => ({
      ...state,
      vscMachineId: action.payload,
    }),
    setSessionId: (
      state: RootStore["config"],
      action: { type: string; payload: string }
    ) => ({
      ...state,
      sessionId: action.payload,
    }),
    setDataSwitchOn: (
      state: RootStore["config"],
      action: { type: string; payload: boolean }
    ) => ({
      ...state,
      dataSwitchOn: action.payload,
    }),
  },
});

export const {
  setVscMachineId,
  setApiUrl,
  setWorkspacePaths,
  setSessionId,
  setDataSwitchOn,
} = configSlice.actions;
export default configSlice.reducer;
