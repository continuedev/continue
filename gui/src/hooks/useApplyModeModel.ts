import { useEffect } from "react";
import { useAuth } from "../context/Auth";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { applyModeModel } from "../redux/thunks/applyModeModel";

/**
 * Keeps the selected chat model in line with the current mode when the config
 * defines `modeModels`. Re-applies when the mode, the config or the user's
 * manual per-mode picks change.
 */
export function useApplyModeModel() {
  const dispatch = useAppDispatch();
  const { selectedProfile } = useAuth();
  const mode = useAppSelector((state) => state.session.mode);
  const modeModels = useAppSelector((state) => state.config.config.modeModels);
  const overrides = useAppSelector((state) => state.ui.modeModelOverrides);

  useEffect(() => {
    if (!selectedProfile) return;
    if (!modeModels && !overrides[mode]) return;
    void dispatch(applyModeModel({ mode, selectedProfile }));
  }, [dispatch, mode, modeModels, overrides, selectedProfile]);
}
