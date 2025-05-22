import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { exitEdit } from "../../../../redux/thunks";
import FileIcon from "../../../FileIcon";
import { getEditFilenameAndRangeText } from "../../util";

export function EditToolbar() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const mode = useAppSelector((state) => state.session.mode);
  const codeToEdit = useAppSelector(
    (state) => state.editModeState.codeToEdit[0],
  );

  return (
    <div className="text-description-muted flex items-center justify-between gap-3">
      <span
        className="flex cursor-pointer items-center whitespace-nowrap hover:brightness-125"
        onClick={async () => {
          void dispatch(exitEdit({}));
          ideMessenger.post("focusEditor", undefined);
        }}
      >
        <ArrowLeftIcon className="mr-2 h-2.5 w-2.5" />
        Back to {mode.charAt(0).toUpperCase() + mode.slice(1)}
      </span>
      <span className="flex items-center gap-0.5 truncate">
        <FileIcon
          filename={codeToEdit.filepath}
          height={"18px"}
          width={"18px"}
        />
        <span className="truncate">
          {getEditFilenameAndRangeText(codeToEdit)}
        </span>
      </span>
    </div>
  );
}
