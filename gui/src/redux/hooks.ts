import { useSelector } from "react-redux";
import { RootState } from "./store";

export const useConfigError = () =>
  useSelector((store: RootState) => store.state.configError);
