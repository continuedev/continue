import { createSlice } from "@reduxjs/toolkit";
import { RootStore } from "../store";

export const configSlice = createSlice({
  name: "config",
  initialState: {
    apiUrl: "http://localhost:65432",
  } as RootStore["config"],
  reducers: {
    setWorkspacePath: (
      state: RootStore["config"],
      action: { type: string; payload: string }
    ) => {
      return {
        ...state,
        workspacePath: action.payload,
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
    setVscMediaUrl: (
      state: RootStore["config"],
      action: { type: string; payload: string }
    ) => ({
      ...state,
      vscMediaUrl: action.payload,
    }),
    setDataSwitchOn: (
      state: RootStore["config"],
      action: { type: string; payload: boolean }
    ) => ({
      ...state,
      dataSwitchOn: action.payload,
    })
  },
});

export const {
  setVscMachineId,
  setApiUrl,
  setWorkspacePath,
  setSessionId,
  setVscMediaUrl,
  setDataSwitchOn
} = configSlice.actions;
export default configSlice.reducer;
