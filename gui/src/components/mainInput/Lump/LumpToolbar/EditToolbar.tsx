import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { exitEdit } from "../../../../redux/thunks/edit";
import { getEditFilenameAndRangeText } from "../../util";

export function EditToolbar() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const mode = useAppSelector((state) => state.session.mode);
  const codeToEdit = useAppSelector(
    (state) => state.editModeState.codeToEdit[0],
  );

  const handleBackClick = async () => {
    void dispatch(exitEdit({}));
    ideMessenger.post("focusEditor", undefined);
  };

  return (
    <div className="text-description-muted flex items-center justify-between gap-3 text-xs">
      <span
        className="flex cursor-pointer items-center whitespace-nowrap hover:brightness-125"
        onClick={handleBackClick}
      >
        <ArrowLeftIcon className="mr-1 h-2.5 w-2.5" />
        Back to {mode.charAt(0).toUpperCase() + mode.slice(1)}
      </span>
      <span className="truncate">
        Editing:{" "}
        <span className="italic">
          {getEditFilenameAndRangeText(codeToEdit)}
        </span>
      </span>
    </div>
  );
}
