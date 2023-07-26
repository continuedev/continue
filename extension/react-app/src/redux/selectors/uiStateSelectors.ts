import { RootStore } from "../store";

const selectBottomMessage = (state: RootStore) => state.uiState.bottomMessage;

export { selectBottomMessage };
