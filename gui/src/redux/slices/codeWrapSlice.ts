import { createSlice } from '@reduxjs/toolkit';

const isWrappedSlice = createSlice({
  name: "codeWrap",
  initialState: "pre",
  reducers: {
    toggle: (state) => (state === "pre" ? "pre-wrap" : "pre"),
  },
});

export const { toggle } = isWrappedSlice.actions;
export default isWrappedSlice.reducer;