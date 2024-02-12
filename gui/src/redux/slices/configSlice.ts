import { createSlice } from "@reduxjs/toolkit";
import { RootStore } from "../store";

export const configSlice = createSlice({
  name: "config",
  initialState: {
    vscMachineId: window.vscMachineId || undefined,
  } as RootStore["config"],
  reducers: {
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

export const { setVscMachineId, setSessionId, setDataSwitchOn } =
  configSlice.actions;
export default configSlice.reducer;
