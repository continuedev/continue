import { PayloadAction, createSlice } from "@reduxjs/toolkit";

const windowAny: any = window;

export const configSlice = createSlice({
  name: "config",
  initialState: {
    vscMachineId: window.vscMachineId,
  },
  reducers: {
    setVscMachineId: (state, action: PayloadAction<string>) => {
      state.vscMachineId = action.payload;
    },
  },
});

export const { setVscMachineId } = configSlice.actions;
export default configSlice.reducer;
