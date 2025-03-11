import { useRef } from "react";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch } from "../../redux/hooks";
import { setIsExploreDialogOpen } from "../../redux/slices/uiSlice";
import {
  getLocalStorage,
  LocalStorageKey,
  setLocalStorage,
} from "../../util/localStorage";

const useTutorialListener = (onTutorialClosed: () => void) => {
  const isTutorialOpenRef = useRef(false);

  useWebviewListener("didChangeActiveTextEditor", async (data) => {
    const filepath = data?.filepath?.toLowerCase() ?? "";
    const isTutorial =
      filepath.endsWith("continue_tutorial.py") ||
      filepath.endsWith("continue_tutorial.java") ||
      filepath.endsWith("continue_tutorial.ts");

    if (isTutorialOpenRef.current && !isTutorial) {
      onTutorialClosed();
    }

    isTutorialOpenRef.current = isTutorial;
  });
};

export const ExploreDialogWatcher = () => {
  const dispatch = useAppDispatch();

  useTutorialListener(() => {
    setLocalStorage(LocalStorageKey.IsExploreDialogOpen, true);

    if (!getLocalStorage(LocalStorageKey.HasDismissedExploreDialog)) {
      dispatch(setIsExploreDialogOpen(true));
    }
  });
  return null;
};
