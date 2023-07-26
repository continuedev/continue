import { createSlice } from "@reduxjs/toolkit";

export const uiStateSlice = createSlice({
  name: "uiState",
  initialState: {
    bottomMessage: undefined,
    bottomMessageCloseTimeout: undefined,
  },
  reducers: {
    setBottomMessage: (state, action) => {
      state.bottomMessage = action.payload;
    },
    setBottomMessageCloseTimeout: (state, action) => {
      if (state.bottomMessageCloseTimeout) {
        clearTimeout(state.bottomMessageCloseTimeout);
      }
      state.bottomMessageCloseTimeout = action.payload;
    },
  },
});

export const { setBottomMessage, setBottomMessageCloseTimeout } =
  uiStateSlice.actions;
export default uiStateSlice.reducer;
