import { createSlice } from "@reduxjs/toolkit";
import { RootStore } from "../store";

const windowAny: any = window;

export const configSlice = createSlice({
  name: "config",
  initialState: {
    vscMachineId: windowAny.vscMachineId || undefined,
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
