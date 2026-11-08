import { useEffect } from "react";
import { useAuth } from "../context/Auth";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { selectModelUse } from "../redux/selectors/selectModelUse";
import { applyModeModel } from "../redux/thunks/applyModeModel";

/**
 * Keeps the selected chat model in line with what the next request is for
 * (the mode, or a Loop item or re-plan) when the config defines `modeModels`.
 * Re-applies when that, the config or the user's manual per-mode picks change.
 */
export function useApplyModeModel() {
  const dispatch = useAppDispatch();
  const { selectedProfile } = useAuth();
  const use = useAppSelector(selectModelUse);
  const modeModels = useAppSelector((state) => state.config.config.modeModels);
  const overrides = useAppSelector((state) => state.ui.modeModelOverrides);

  useEffect(() => {
    if (!selectedProfile || !use) return;
    if (!modeModels && !overrides[use as keyof typeof overrides]) return;
    void dispatch(applyModeModel({ mode: use, selectedProfile }));
  }, [dispatch, use, modeModels, overrides, selectedProfile]);
}
