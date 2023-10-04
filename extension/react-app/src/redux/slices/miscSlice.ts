import { createSlice } from "@reduxjs/toolkit";

export const miscSlice = createSlice({
  name: "misc",
  initialState: {
    highlightedCode: "",
    takenAction: false,
  },
  reducers: {
    setHighlightedCode: (state: any, action) => {
      state.highlightedCode = action.payload;
    },
    setTakenActionTrue: (state: any, action) => {
      state.takenAction = true;
    },
  },
});

export const { setHighlightedCode, setTakenActionTrue } = miscSlice.actions;
export default miscSlice.reducer;
