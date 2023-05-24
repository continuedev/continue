import { RootStore } from "../store";

const selectHighlightedCode = (state: RootStore) => state.misc.highlightedCode;

export { selectHighlightedCode };
