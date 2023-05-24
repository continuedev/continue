import { createSlice } from "@reduxjs/toolkit";

export const miscSlice = createSlice({
  name: "misc",
  initialState: {
    highlightedCode: "",
  },
  reducers: {
    setHighlightedCode: (state, action) => {
      state.highlightedCode = action.payload;
    },
  },
});

export const { setHighlightedCode } = miscSlice.actions;
export default miscSlice.reducer;
