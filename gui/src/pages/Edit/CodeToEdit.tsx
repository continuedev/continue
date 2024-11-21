import { InformationCircleIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { CodeToEdit, removeCodeToEdit } from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";
import CodeToEditListItem from "./CodeToEditListItem";
import { RangeInFileWithContents } from "core/commands/util";
import { vscEditorBackground } from "../../components";
import { setShouldAddFileForEditing } from "../../redux/slices/uiStateSlice";

export default function WorkingSet() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const editModeState = useSelector((state: RootState) => state.editModeState);

  const hasCodeToEdit = editModeState.codeToEdit.length > 0;

  function onDelete(rif: RangeInFileWithContents) {
    dispatch(removeCodeToEdit(rif));
  }

  function onClickAddFileToCodeToEdit() {
    dispatch(setShouldAddFileForEditing(true));
  }

  function onClickFilename(code: CodeToEdit) {
    if ("range" in code) {
      ideMessenger.ide.showLines(
        code.filepath,
        code.range.start.line,
        code.range.end.line,
      );
    } else {
      ideMessenger.ide.openFile(code.filepath);
    }
  }

  const codeToEditItems = editModeState.codeToEdit.map((code, i) => (
    <CodeToEditListItem
      key={code.filepath + i}
      code={code}
      onDelete={onDelete}
      onClickFilename={onClickFilename}
    />
  ));

  return (
    <div
      className="mx-1 flex flex-col rounded-t-lg px-1 pb-1"
      style={{ backgroundColor: vscEditorBackground }}
    >
      <div className="flex items-center justify-between gap-1.5 px-1 py-1.5 text-xs text-neutral-500">
        <span>Code to edit</span>

        <span
          className="flex cursor-pointer items-center justify-between gap-1 rounded px-1 py-0.5 transition-colors hover:bg-white/10"
          onClick={onClickAddFileToCodeToEdit}
        >
          <PlusIcon className="inline h-3 w-3" />
          <span>Add file</span>
        </span>
      </div>

      <div className="scrollbar-hide max-h-[25vh] overflow-y-auto">
        {hasCodeToEdit ? (
          <ul className="my-1.5 list-outside list-none space-y-1.5 pl-0">
            {codeToEditItems}
          </ul>
        ) : (
          <span
            className="my-1.5 flex cursor-pointer items-center gap-1 rounded p-1 transition-colors hover:bg-white/10"
            onClick={onClickAddFileToCodeToEdit}
          >
            <PlusIcon className="inline h-3 w-3" />
            <span>Add a file to get started</span>
          </span>
        )}
      </div>
    </div>
  );
}
