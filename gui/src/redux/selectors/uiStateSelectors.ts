import { RootState } from "../store";

const selectBottomMessage = (state: RootState) => state.uiState.bottomMessage;

export { selectBottomMessage };
